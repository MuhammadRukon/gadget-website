import { PaymentMethod, type PaymentSettings } from '@prisma/client';

import type { CodFeeRule } from '@/contracts/payment-settings';

import { computeCodConfirmationFee } from './cod-fee';

/**
 * Single source of truth for order total math, shared by `quote()` and
 * `placeOrder` so the two can never drift. All values are integer cents.
 */
export function computeOrderTotals(input: {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
}): number {
  return Math.max(0, input.subtotalCents - input.discountCents) + input.shippingCents;
}

export interface ResolvedCodFee {
  feeCents: number;
  rule: CodFeeRule;
}

/**
 * The COD confirmation fee that applies to an order, or `null` when none
 * does (not COD, fee switched off, or the computed fee is 0). A `null`
 * result means the COD order auto-confirms as it always has.
 */
export function resolveCodFee(input: {
  method: PaymentMethod;
  settings: Pick<PaymentSettings, 'codFeeEnabled' | 'codFeeType' | 'codFeeValue'>;
  totalCents: number;
}): ResolvedCodFee | null {
  const { method, settings, totalCents } = input;
  if (method !== PaymentMethod.COD || !settings.codFeeEnabled) return null;

  const feeCents = computeCodConfirmationFee({
    type: settings.codFeeType,
    value: settings.codFeeValue,
    totalCents,
  });
  if (feeCents <= 0) return null;

  return { feeCents, rule: { type: settings.codFeeType, value: settings.codFeeValue } };
}
