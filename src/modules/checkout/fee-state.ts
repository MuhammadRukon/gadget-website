import type { OrderStatus, Payment } from '@prisma/client';

import { canFee } from '@/lib/cod-fee/policy';

export type FeeNoticeState = 'none' | 'pending' | 'rejected' | 'verified';

/**
 * What the order page should say about the COD confirmation fee.
 * Admin verify confirms the order, so VERIFIED is shown for any non-cancelled
 * status; the actionable states (pending, rejected) only apply while the
 * order is still PENDING. WAIVED, NONE, non-COD and CANCELLED show nothing.
 */
export function getFeeNoticeState(
  orderStatus: OrderStatus,
  payment: Pick<Payment, 'method' | 'feeStatus'> | undefined,
): FeeNoticeState {
  if (!payment || payment.method !== 'COD' || orderStatus === 'CANCELLED') return 'none';

  // Actionable states (the fee can still be decided) only apply while the order
  // is PENDING; VERIFIED has no remaining action and shows for any live order.
  if (payment.feeStatus === 'VERIFIED') return 'verified';
  if (orderStatus !== 'PENDING' || !canFee('verify', payment.feeStatus)) return 'none';
  return payment.feeStatus === 'REJECTED' ? 'rejected' : 'pending';
}
