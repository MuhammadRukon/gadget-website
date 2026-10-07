import { CodFeeType, PaymentMethod, type Prisma, type PaymentSettings } from '@prisma/client';

import type { PaymentSettingsInput } from '@/contracts/payment-settings';
import { prisma } from '@/lib/prisma';
import { BadRequestError } from '@/server/common/errors';
import { log } from '@/server/common/logger';
import { mediaService } from '@/server/media/media.service';
import { gatewayConfigured } from '@/server/payments/registry';

/** Either the global client or an in-flight `prisma.$transaction` callback client. */
type Db = typeof prisma | Prisma.TransactionClient;

export const PAYMENT_SETTINGS_ID = 'singleton';

/** Matches the migration's seeded row; returned (never written) when the row is missing. */
function defaultSettings(): PaymentSettings {
  return {
    id: PAYMENT_SETTINGS_ID,
    codEnabled: true,
    bkashEnabled: false,
    sslcommerzEnabled: false,
    bankTransferEnabled: false,
    codFeeEnabled: false,
    codFeeType: CodFeeType.FLAT,
    codFeeValue: 0,
    qrImageUrl: null,
    qrImagePublicId: null,
    contactNumber: null,
    paymentNote: null,
    updatedAt: new Date(0),
    updatedById: null,
  };
}

type MethodFlags = Pick<
  PaymentSettings,
  'codEnabled' | 'bkashEnabled' | 'sslcommerzEnabled' | 'bankTransferEnabled'
>;

/** Methods whose admin flag is on, in `PaymentMethod` enum order. */
function flaggedMethods(flags: MethodFlags): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  if (flags.codEnabled) methods.push(PaymentMethod.COD);
  if (flags.sslcommerzEnabled) methods.push(PaymentMethod.SSLCOMMERZ);
  if (flags.bkashEnabled) methods.push(PaymentMethod.BKASH);
  if (flags.bankTransferEnabled) methods.push(PaymentMethod.BANK_TRANSFER);
  return methods;
}

export const paymentSettingsService = {
  /** The settings singleton, or in-memory defaults (COD on, fee off) if the row is missing. */
  async get(client: Db = prisma): Promise<PaymentSettings> {
    const row = await client.paymentSettings.findUnique({ where: { id: PAYMENT_SETTINGS_ID } });
    return row ?? defaultSettings();
  },

  /**
   * Methods a customer may actually use: flagged on by the admin AND, for
   * gateways, configured with credentials (an unconfigured gateway would
   * fall back to the self-payable sandbox harness).
   */
  async getEffective(client: Db = prisma): Promise<PaymentMethod[]> {
    const settings = await paymentSettingsService.get(client);
    return flaggedMethods(settings).filter(gatewayConfigured);
  },

  /**
   * Full replacement of the singleton (PUT semantics): omitted optional
   * fields are stored as null. Deletes the previous QR from Cloudinary when
   * `qrImagePublicId` changes or is cleared; a failed delete is logged and
   * does not fail the save.
   */
  async update(adminId: string, input: PaymentSettingsInput): Promise<PaymentSettings> {
    const data = {
      codEnabled: input.codEnabled,
      bkashEnabled: input.bkashEnabled,
      sslcommerzEnabled: input.sslcommerzEnabled,
      bankTransferEnabled: input.bankTransferEnabled,
      codFeeEnabled: input.codFeeEnabled,
      codFeeType: input.codFeeType,
      codFeeValue: input.codFeeValue,
      qrImageUrl: input.qrImageUrl ?? null,
      qrImagePublicId: input.qrImagePublicId ?? null,
      contactNumber: input.contactNumber ?? null,
      paymentNote: input.paymentNote ?? null,
      updatedById: adminId,
    };

    const { saved, previousPublicId } = await prisma.$transaction(async (tx) => {
      const current = await paymentSettingsService.get(tx);

      // Only newly-enabled gateways are rejected, so a gateway whose
      // credentials were removed later can still be switched off or left
      // alone while other settings change (getEffective already hides it).
      const newlyEnabledWithoutCreds = flaggedMethods(data).filter(
        (m) => !flaggedMethods(current).includes(m) && !gatewayConfigured(m),
      );
      if (newlyEnabledWithoutCreds.length > 0) {
        throw new BadRequestError(
          `Cannot enable ${newlyEnabledWithoutCreds.join(', ')}: gateway credentials are not configured`,
        );
      }

      if (flaggedMethods(data).filter(gatewayConfigured).length === 0) {
        throw new BadRequestError('At least one payment method must remain enabled');
      }

      const row = await tx.paymentSettings.upsert({
        where: { id: PAYMENT_SETTINGS_ID },
        create: { id: PAYMENT_SETTINGS_ID, ...data },
        update: data,
      });
      return { saved: row, previousPublicId: current.qrImagePublicId };
    });

    if (previousPublicId && previousPublicId !== saved.qrImagePublicId) {
      try {
        await mediaService.deleteImage(previousPublicId);
      } catch (err) {
        log.warn('settings.qr_delete_failed', {
          publicId: previousPublicId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return saved;
  },
};
