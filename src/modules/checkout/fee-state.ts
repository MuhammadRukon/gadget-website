import type { OrderStatus, Payment } from '@prisma/client';

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

  switch (payment.feeStatus) {
    case 'VERIFIED':
      return 'verified';
    case 'PENDING':
      return orderStatus === 'PENDING' ? 'pending' : 'none';
    case 'REJECTED':
      return orderStatus === 'PENDING' ? 'rejected' : 'none';
    default:
      return 'none';
  }
}

/** Order-page alert for a fee the admin could not verify. */
export function buildFeeRejectedMessage(contactNumber: string | null): string {
  return `Your confirmation fee could not be verified. ${
    contactNumber ? `Contact admin at ${contactNumber}.` : 'Contact admin.'
  }`;
}
