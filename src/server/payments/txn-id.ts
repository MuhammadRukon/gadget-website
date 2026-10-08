import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { normalizeTxnId } from '@/contracts/payments';
import { TxnIdDuplicateError } from '@/server/common/errors';

/** Either the global client or an in-flight `prisma.$transaction` callback client. */
type Db = typeof prisma | Prisma.TransactionClient;

/**
 * Finds a payment that already uses this transaction id, as a customer-
 * submitted id or a bank-transfer reference. Optionally ignores one payment
 * (the one being edited).
 *
 * `customerTxnId` is always stored normalized (trimmed, uppercase), so it is
 * matched exactly: that keeps its unique index usable. `bankRef` is free text
 * entered before normalization existed, so it stays case-insensitive.
 */
export function findPaymentByTxnId(client: Db, txnId: string, excludePaymentId?: string) {
  const id = normalizeTxnId(txnId);
  return client.payment.findFirst({
    where: {
      ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
      OR: [{ customerTxnId: id }, { bankRef: { equals: id, mode: 'insensitive' } }],
    },
    select: { id: true, order: { select: { id: true, orderNumber: true } } },
  });
}

/** True for the unique-constraint violation on `Payment.customerTxnId`. */
export function isTxnIdUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export interface TxnIdCheckOptions {
  /** Ignore this payment (the one being edited). */
  excludePaymentId?: string;
  /**
   * Admin-only: put the conflicting order's id/number in the error. Customer
   * callers leave this off so a duplicate reveals nothing about another order.
   */
  revealOrder?: boolean;
}

function duplicateError(
  existing: { order: { id: string; orderNumber: string } } | null,
  revealOrder?: boolean,
) {
  if (!existing || !revealOrder) return new TxnIdDuplicateError();
  return new TxnIdDuplicateError(
    `Transaction ID is already used on order ${existing.order.orderNumber}`,
    { existingOrderId: existing.order.id, existingOrderNumber: existing.order.orderNumber },
  );
}

/** Pre-check: throws TxnIdDuplicateError if another payment already uses `txnId`. */
export async function assertTxnIdFree(
  db: Db,
  txnId: string,
  opts: TxnIdCheckOptions = {},
): Promise<void> {
  const existing = await findPaymentByTxnId(db, txnId, opts.excludePaymentId);
  if (existing) throw duplicateError(existing, opts.revealOrder);
}

/**
 * For a write that lost a race on the `customerTxnId` unique index despite
 * `assertTxnIdFree`: maps the P2002 to the same TxnIdDuplicateError the
 * pre-check throws. Any other error is returned unchanged. Use as
 * `throw await mapTxnIdViolation(err, txnId, opts)`.
 */
export async function mapTxnIdViolation(
  err: unknown,
  txnId: string,
  opts: TxnIdCheckOptions = {},
): Promise<unknown> {
  if (!isTxnIdUniqueViolation(err)) return err;
  // The transaction is dead, so the admin lookup of the winner uses the global client.
  const existing = opts.revealOrder
    ? await findPaymentByTxnId(prisma, txnId, opts.excludePaymentId)
    : null;
  return duplicateError(existing, opts.revealOrder);
}
