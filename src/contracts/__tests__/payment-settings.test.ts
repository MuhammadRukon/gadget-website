import { CodFeeType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { paymentSettingsInputSchema } from '../payment-settings';

const valid = {
  codEnabled: true,
  bkashEnabled: false,
  sslcommerzEnabled: false,
  bankTransferEnabled: false,
  codFeeEnabled: true,
  codFeeType: CodFeeType.FLAT,
  codFeeValue: 10_000,
  qrImageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/settings/qr.png',
  qrImagePublicId: 'settings/qr',
  contactNumber: '01800000000',
  paymentNote: 'Pay via bKash personal.',
};

function issuePaths(input: unknown): string[] {
  const res = paymentSettingsInputSchema.safeParse(input);
  if (res.success) return [];
  return res.error.issues.map((i) => i.path.join('.'));
}

describe('paymentSettingsInputSchema', () => {
  it('accepts a valid FLAT configuration', () => {
    expect(paymentSettingsInputSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a valid PERCENT configuration', () => {
    const res = paymentSettingsInputSchema.safeParse({
      ...valid,
      codFeeType: CodFeeType.PERCENT,
      codFeeValue: 25,
    });
    expect(res.success).toBe(true);
  });

  it('accepts +880 / 880 / local mobile formats', () => {
    for (const contactNumber of ['01800000000', '8801800000000', '+8801800000000']) {
      expect(paymentSettingsInputSchema.safeParse({ ...valid, contactNumber }).success).toBe(true);
    }
  });

  it('rejects PERCENT value 0', () => {
    const input = { ...valid, codFeeType: CodFeeType.PERCENT, codFeeValue: 0 };
    expect(paymentSettingsInputSchema.safeParse(input).success).toBe(false);
    expect(issuePaths(input)).toContain('codFeeValue');
  });

  it('rejects PERCENT value 101', () => {
    const input = { ...valid, codFeeType: CodFeeType.PERCENT, codFeeValue: 101 };
    expect(paymentSettingsInputSchema.safeParse(input).success).toBe(false);
    expect(issuePaths(input)).toContain('codFeeValue');
  });

  it('rejects a non-integer PERCENT value', () => {
    const input = { ...valid, codFeeType: CodFeeType.PERCENT, codFeeValue: 12.5 };
    expect(paymentSettingsInputSchema.safeParse(input).success).toBe(false);
  });

  it('rejects FLAT value 150 (not a multiple of 100 cents)', () => {
    const input = { ...valid, codFeeType: CodFeeType.FLAT, codFeeValue: 150 };
    expect(paymentSettingsInputSchema.safeParse(input).success).toBe(false);
    expect(issuePaths(input)).toContain('codFeeValue');
  });

  it('rejects FLAT value below 100 cents', () => {
    const input = { ...valid, codFeeType: CodFeeType.FLAT, codFeeValue: 0 };
    expect(paymentSettingsInputSchema.safeParse(input).success).toBe(false);
  });

  it('rejects codFeeEnabled=true without contactNumber', () => {
    const input = { ...valid, contactNumber: null };
    expect(paymentSettingsInputSchema.safeParse(input).success).toBe(false);
    expect(issuePaths(input)).toContain('contactNumber');
    const omitted: Record<string, unknown> = { ...valid };
    delete omitted.contactNumber;
    expect(paymentSettingsInputSchema.safeParse(omitted).success).toBe(false);
  });

  it('allows a missing contactNumber when codFeeEnabled=false', () => {
    const res = paymentSettingsInputSchema.safeParse({
      ...valid,
      codFeeEnabled: false,
      contactNumber: null,
    });
    expect(res.success).toBe(true);
  });

  it("rejects contactNumber '12345'", () => {
    const input = { ...valid, contactNumber: '12345' };
    expect(paymentSettingsInputSchema.safeParse(input).success).toBe(false);
    expect(issuePaths(input)).toContain('contactNumber');
  });

  it('rejects a non-Cloudinary / non-https qrImageUrl', () => {
    for (const qrImageUrl of ['http://evil.com/x.png', 'https://evil.com/x.png']) {
      const input = { ...valid, qrImageUrl };
      expect(paymentSettingsInputSchema.safeParse(input).success).toBe(false);
      expect(issuePaths(input)).toContain('qrImageUrl');
    }
  });

  it('accepts a null qrImageUrl', () => {
    const res = paymentSettingsInputSchema.safeParse({
      ...valid,
      qrImageUrl: null,
      qrImagePublicId: null,
    });
    expect(res.success).toBe(true);
  });

  it('rejects a paymentNote over 500 characters', () => {
    const input = { ...valid, paymentNote: 'x'.repeat(501) };
    expect(paymentSettingsInputSchema.safeParse(input).success).toBe(false);
    expect(
      paymentSettingsInputSchema.safeParse({ ...valid, paymentNote: 'x'.repeat(500) }).success,
    ).toBe(true);
  });

  it('has no defaults on the enabled flags', () => {
    const rest: Record<string, unknown> = { ...valid };
    delete rest.codEnabled;
    expect(paymentSettingsInputSchema.safeParse(rest).success).toBe(false);
  });
});
