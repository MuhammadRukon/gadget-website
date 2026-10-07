/**
 * Live-DB tests (same tradeoff as payments.service.test.ts: no Prisma
 * mocking convention in this repo). The PaymentSettings singleton is
 * snapshotted before each test and restored afterwards. Cloudinary is
 * never hit: `mediaService.deleteImage` is spied on.
 */
import { CodFeeType, PaymentMethod, type PaymentSettings } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import type { PaymentSettingsInput } from '@/contracts/payment-settings';
import { prisma } from '@/lib/prisma';
import { BadRequestError } from '@/server/common/errors';
import { mediaService } from '@/server/media/media.service';

import { paymentSettingsService } from '../payment-settings.service';

const TEST_TIMEOUT = 60_000;
const SINGLETON = 'singleton';

const BKASH_ENV_KEYS = [
  'BKASH_BASE_URL',
  'BKASH_APP_KEY',
  'BKASH_APP_SECRET',
  'BKASH_USERNAME',
  'BKASH_PASSWORD',
];
const GATEWAY_ENV_KEYS = [...BKASH_ENV_KEYS, 'SSLCOMMERZ_STORE_ID', 'SSLCOMMERZ_STORE_PASSWORD'];

/** Blank values are falsy, so every gateway reads as "no credentials". */
function clearGatewayEnv() {
  for (const key of GATEWAY_ENV_KEYS) vi.stubEnv(key, '');
}

function setBkashEnv() {
  for (const key of BKASH_ENV_KEYS) vi.stubEnv(key, 'test-value');
}

function input(overrides: Partial<PaymentSettingsInput> = {}): PaymentSettingsInput {
  return {
    codEnabled: true,
    bkashEnabled: false,
    sslcommerzEnabled: false,
    bankTransferEnabled: false,
    codFeeEnabled: false,
    codFeeType: CodFeeType.FLAT,
    codFeeValue: 10_000,
    qrImageUrl: null,
    qrImagePublicId: null,
    contactNumber: null,
    paymentNote: null,
    ...overrides,
  };
}

function qr(publicId: string) {
  return {
    qrImageUrl: `https://res.cloudinary.com/demo/image/upload/${publicId}.png`,
    qrImagePublicId: publicId,
  };
}

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

let original: PaymentSettings | null = null;
let deleteImage: MockInstance<typeof mediaService.deleteImage>;

beforeEach(async () => {
  original = await prisma.paymentSettings.findUnique({ where: { id: SINGLETON } });
  deleteImage = vi.spyOn(mediaService, 'deleteImage').mockResolvedValue(undefined);
  clearGatewayEnv();
}, TEST_TIMEOUT);

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  if (original) {
    const { id, updatedAt, ...data } = original;
    void updatedAt;
    await prisma.paymentSettings.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  } else {
    await prisma.paymentSettings.deleteMany({ where: { id: SINGLETON } });
  }
}, TEST_TIMEOUT);

describe('paymentSettingsService.get', () => {
  it(
    'returns defaults without creating a row when the singleton is missing',
    async () => {
      await prisma.paymentSettings.deleteMany({ where: { id: SINGLETON } });

      const settings = await paymentSettingsService.get();

      expect(settings.codEnabled).toBe(true);
      expect(settings.bkashEnabled).toBe(false);
      expect(settings.sslcommerzEnabled).toBe(false);
      expect(settings.bankTransferEnabled).toBe(false);
      expect(settings.codFeeEnabled).toBe(false);
      expect(await prisma.paymentSettings.count({ where: { id: SINGLETON } })).toBe(0);
    },
    TEST_TIMEOUT,
  );

  it(
    'accepts a transaction client',
    async () => {
      await prisma.paymentSettings.upsert({
        where: { id: SINGLETON },
        create: { id: SINGLETON, bankTransferEnabled: true },
        update: { bankTransferEnabled: true },
      });
      const settings = await prisma.$transaction((tx) => paymentSettingsService.get(tx));
      expect(settings.bankTransferEnabled).toBe(true);
    },
    TEST_TIMEOUT,
  );
});

describe('paymentSettingsService.update', () => {
  it(
    'throws BadRequestError when every method is disabled',
    async () => {
      await expect(
        paymentSettingsService.update('admin-1', input({ codEnabled: false })),
      ).rejects.toBeInstanceOf(BadRequestError);
    },
    TEST_TIMEOUT,
  );

  it(
    'throws BadRequestError when the only enabled method has no credentials',
    async () => {
      // Flag is on but the gateway is not configured, so nothing is effective.
      await expect(
        paymentSettingsService.update('admin-1', input({ codEnabled: false, bkashEnabled: true })),
      ).rejects.toBeInstanceOf(BadRequestError);
    },
    TEST_TIMEOUT,
  );

  it(
    'throws BadRequestError mentioning credentials when enabling BKASH without them',
    async () => {
      const err = await paymentSettingsService
        .update('admin-1', input({ bkashEnabled: true }))
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestError);
      expect((err as BadRequestError).message).toContain('credentials');
    },
    TEST_TIMEOUT,
  );

  it(
    'does not persist anything when validation fails',
    async () => {
      await prisma.paymentSettings.deleteMany({ where: { id: SINGLETON } });
      await paymentSettingsService
        .update('admin-1', input({ bkashEnabled: true }))
        .catch(() => null);
      expect(await prisma.paymentSettings.count({ where: { id: SINGLETON } })).toBe(0);
    },
    TEST_TIMEOUT,
  );

  it(
    'allows enabling BKASH when credentials are present',
    async () => {
      setBkashEnv();
      const saved = await paymentSettingsService.update('admin-1', input({ bkashEnabled: true }));
      expect(saved.bkashEnabled).toBe(true);
    },
    TEST_TIMEOUT,
  );

  it(
    'persists updatedById and the submitted fields',
    async () => {
      const adminId = randomId('admin');
      const saved = await paymentSettingsService.update(
        adminId,
        input({
          bankTransferEnabled: true,
          codFeeEnabled: true,
          codFeeType: CodFeeType.PERCENT,
          codFeeValue: 25,
          contactNumber: '01800000000',
          paymentNote: 'note',
        }),
      );
      expect(saved.updatedById).toBe(adminId);

      const row = await prisma.paymentSettings.findUniqueOrThrow({ where: { id: SINGLETON } });
      expect(row.updatedById).toBe(adminId);
      expect(row.bankTransferEnabled).toBe(true);
      expect(row.codFeeEnabled).toBe(true);
      expect(row.codFeeType).toBe(CodFeeType.PERCENT);
      expect(row.codFeeValue).toBe(25);
      expect(row.contactNumber).toBe('01800000000');
      expect(row.paymentNote).toBe('note');
    },
    TEST_TIMEOUT,
  );

  it(
    'deletes the old QR exactly once when qrImagePublicId changes from A to B',
    async () => {
      const a = randomId('settings/qr-a');
      const b = randomId('settings/qr-b');

      await paymentSettingsService.update('admin-1', input(qr(a)));
      expect(deleteImage).not.toHaveBeenCalled();

      await paymentSettingsService.update('admin-1', input(qr(b)));
      expect(deleteImage).toHaveBeenCalledTimes(1);
      expect(deleteImage).toHaveBeenCalledWith(a);
    },
    TEST_TIMEOUT,
  );

  it(
    'does not delete the QR when the publicId is unchanged',
    async () => {
      const a = randomId('settings/qr-a');

      await paymentSettingsService.update('admin-1', input(qr(a)));
      await paymentSettingsService.update('admin-1', input({ ...qr(a), paymentNote: 'changed' }));
      expect(deleteImage).not.toHaveBeenCalled();
    },
    TEST_TIMEOUT,
  );

  it(
    'deletes the old QR exactly once when the QR is cleared',
    async () => {
      const a = randomId('settings/qr-a');
      await paymentSettingsService.update('admin-1', input(qr(a)));

      const saved = await paymentSettingsService.update(
        'admin-1',
        input({ qrImageUrl: null, qrImagePublicId: null }),
      );
      expect(saved.qrImagePublicId).toBeNull();
      expect(deleteImage).toHaveBeenCalledTimes(1);
      expect(deleteImage).toHaveBeenCalledWith(a);
    },
    TEST_TIMEOUT,
  );

  it(
    'still saves when deleting the old QR fails',
    async () => {
      const a = randomId('settings/qr-a');
      await paymentSettingsService.update('admin-1', input(qr(a)));
      deleteImage.mockRejectedValueOnce(new Error('cloudinary down'));
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      const saved = await paymentSettingsService.update(
        'admin-1',
        input({ qrImageUrl: null, qrImagePublicId: null }),
      );
      expect(saved.qrImagePublicId).toBeNull();
    },
    TEST_TIMEOUT,
  );
});

describe('paymentSettingsService.getEffective', () => {
  it(
    'excludes a gateway whose flag is true but whose credentials are missing',
    async () => {
      await prisma.paymentSettings.upsert({
        where: { id: SINGLETON },
        create: { id: SINGLETON, codEnabled: true, bkashEnabled: true, bankTransferEnabled: true },
        update: { codEnabled: true, bkashEnabled: true, bankTransferEnabled: true },
      });

      const methods = await paymentSettingsService.getEffective();

      expect(methods).toContain(PaymentMethod.COD);
      expect(methods).toContain(PaymentMethod.BANK_TRANSFER);
      expect(methods).not.toContain(PaymentMethod.BKASH);
    },
    TEST_TIMEOUT,
  );

  it(
    'includes the gateway once credentials are present',
    async () => {
      await prisma.paymentSettings.upsert({
        where: { id: SINGLETON },
        create: { id: SINGLETON, bkashEnabled: true },
        update: { bkashEnabled: true },
      });
      setBkashEnv();

      expect(await paymentSettingsService.getEffective()).toContain(PaymentMethod.BKASH);
    },
    TEST_TIMEOUT,
  );

  it(
    'falls back to COD only when the singleton row is missing',
    async () => {
      await prisma.paymentSettings.deleteMany({ where: { id: SINGLETON } });
      expect(await paymentSettingsService.getEffective()).toEqual([PaymentMethod.COD]);
    },
    TEST_TIMEOUT,
  );

  it(
    'accepts a transaction client',
    async () => {
      const methods = await prisma.$transaction((tx) => paymentSettingsService.getEffective(tx));
      expect(Array.isArray(methods)).toBe(true);
    },
    TEST_TIMEOUT,
  );
});
