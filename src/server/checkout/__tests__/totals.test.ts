import { CodFeeType, PaymentMethod } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { computeOrderTotals, resolveCodFee } from '../totals';

function settings(overrides: Partial<Parameters<typeof resolveCodFee>[0]['settings']> = {}) {
  return {
    codFeeEnabled: true,
    codFeeType: CodFeeType.FLAT,
    codFeeValue: 10_000,
    ...overrides,
  };
}

describe('computeOrderTotals', () => {
  it('is subtotal - discount + shipping', () => {
    expect(computeOrderTotals({ subtotalCents: 100_000, discountCents: 1_000, shippingCents: 6_000 })).toBe(
      105_000,
    );
  });

  it('never lets the discount push the items below zero', () => {
    expect(computeOrderTotals({ subtotalCents: 500, discountCents: 900, shippingCents: 6_000 })).toBe(
      6_000,
    );
  });
});

describe('resolveCodFee', () => {
  it('returns the flat fee and rule for COD when the fee is on', () => {
    expect(
      resolveCodFee({ method: PaymentMethod.COD, settings: settings(), totalCents: 500_000 }),
    ).toEqual({ feeCents: 10_000, rule: { type: CodFeeType.FLAT, value: 10_000 } });
  });

  it('rounds a percent fee up to the next 10 BDT', () => {
    expect(
      resolveCodFee({
        method: PaymentMethod.COD,
        settings: settings({ codFeeType: CodFeeType.PERCENT, codFeeValue: 25 }),
        totalCents: 49_840,
      }),
    ).toEqual({ feeCents: 13_000, rule: { type: CodFeeType.PERCENT, value: 25 } });
  });

  it('caps the fee at the total', () => {
    expect(
      resolveCodFee({ method: PaymentMethod.COD, settings: settings(), totalCents: 6_000 })?.feeCents,
    ).toBe(6_000);
  });

  it('returns null when the fee is off', () => {
    expect(
      resolveCodFee({
        method: PaymentMethod.COD,
        settings: settings({ codFeeEnabled: false }),
        totalCents: 500_000,
      }),
    ).toBeNull();
  });

  it('returns null for non-COD methods', () => {
    for (const method of [PaymentMethod.BANK_TRANSFER, PaymentMethod.BKASH, PaymentMethod.SSLCOMMERZ]) {
      expect(resolveCodFee({ method, settings: settings(), totalCents: 500_000 })).toBeNull();
    }
  });

  it('returns null when the computed fee is 0 (zero total)', () => {
    expect(resolveCodFee({ method: PaymentMethod.COD, settings: settings(), totalCents: 0 })).toBeNull();
    expect(
      resolveCodFee({
        method: PaymentMethod.COD,
        settings: settings({ codFeeType: CodFeeType.PERCENT, codFeeValue: 50 }),
        totalCents: 0,
      }),
    ).toBeNull();
  });

  it('returns null when the flat value is 0', () => {
    expect(
      resolveCodFee({
        method: PaymentMethod.COD,
        settings: settings({ codFeeValue: 0 }),
        totalCents: 500_000,
      }),
    ).toBeNull();
  });
});
