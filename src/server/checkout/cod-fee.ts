import { CodFeeType } from '@prisma/client';

import type { CodFeeRule } from '@/contracts/payment-settings';
import { formatBDT } from '@/server/common/money';

/**
 * COD confirmation fee calculation (pure, integer cents).
 *
 * The fee is an advance credit against the order total: `totalCents` is
 * unchanged and the COD amount due on delivery is `total - fee`.
 *
 *  - FLAT:    `value` is cents; fee = min(value, total).
 *  - PERCENT: `value` is an integer 1..100; fee = ceil(total * value / 100),
 *             rounded UP to the next 10 BDT (1000 cents), then capped at total.
 */
export interface CodFeeInput {
  type: CodFeeType;
  value: number;
  totalCents: number;
}

/** Percent fees are rounded up to the next 10 BDT. */
const ROUND_STEP_CENTS = 1_000;

export function computeCodConfirmationFee(input: CodFeeInput): number {
  const { type, value, totalCents } = input;

  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error('totalCents must be a non-negative integer');
  }
  if (!Number.isInteger(value)) {
    throw new Error('COD fee value must be an integer');
  }

  if (type === CodFeeType.PERCENT) {
    if (value < 1 || value > 100) {
      throw new Error('COD fee percent must be between 1 and 100');
    }
    const raw = Math.ceil((totalCents * value) / 100);
    const rounded = Math.ceil(raw / ROUND_STEP_CENTS) * ROUND_STEP_CENTS;
    return Math.min(rounded, totalCents);
  }

  if (value < 0) {
    throw new Error('COD flat fee must not be negative');
  }
  return Math.min(value, totalCents);
}

/** Human-readable rule text, e.g. `flat Tk 100` or `25% = Tk 130`. */
export function describeCodFeeRule(rule: CodFeeRule, feeCents: number): string {
  return rule.type === CodFeeType.PERCENT
    ? `${rule.value}% = ${formatBDT(feeCents)}`
    : `flat ${formatBDT(feeCents)}`;
}
