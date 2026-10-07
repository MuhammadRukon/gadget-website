import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { normalizeTxnId } from '@/contracts/payments';

/** Either the global client or an in-flight `prisma.$transaction` callback client. */
type Db = typeof prisma | Prisma.TransactionClient;

/**
 * Finds a payment that already uses this transaction id, as a customer-
 * submitted id or a bank-transfer reference (case-insensitive). Optionally
 * ignores one payment (the one being edited).
 */
export function findPaymentByTxnId(client: Db, txnId: string, excludePaymentId?: string) {
  const id = normalizeTxnId(txnId);
  return client.payment.findFirst({
    where: {
      ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
      OR: [
        { customerTxnId: { equals: id, mode: 'insensitive' } },
        { bankRef: { equals: id, mode: 'insensitive' } },
      ],
    },
    select: { id: true, order: { select: { id: true, orderNumber: true } } },
  });
}

/** True for the unique-constraint violation on `Payment.customerTxnId`. */
export function isTxnIdUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
