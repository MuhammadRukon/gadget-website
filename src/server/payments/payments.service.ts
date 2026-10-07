import { CodFeeStatus, OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TxnIdDuplicateError,
} from '@/server/common/errors';
import { log } from '@/server/common/logger';
import { orderStatusEmail, paymentResultEmail, sendMail } from '@/server/common/mailer';
import { claimOrderStatus, restockOrderItems } from '@/server/orders/orders.service';
import { normalizeTxnId, type InitiatedPayment } from '@/contracts/payments';

import type { CallbackOutcome, PaymentInitInput } from './gateway.interface';
import { getGateway } from './registry';
import { findPaymentByTxnId, isTxnIdUniqueViolation } from './txn-id';

/**
 * `payments.service` is the *only* module in the system that:
 *   - calls a `PaymentGateway` strategy
 *   - mutates a `Payment` row
 *   - flips an `Order` between PENDING/CONFIRMED/CANCELLED on payment
 *
 * Everything is idempotent. Callbacks can fire twice (and they do, in
 * practice) so we no-op when the payment is already terminal and we
 * use `providerRef` as the natural dedupe key.
 */

interface KickoffArgs {
  /** Absolute origin used to build success / fail / IPN URLs. */
  origin: string;
}

function buildUrls(origin: string, method: PaymentMethod, paymentId: string, orderId: string) {
  const base = `${origin.replace(/\/$/, '')}`;
  const provider = method.toLowerCase();
  return {
    successUrl: `${base}/api/payments/${provider}/success?paymentId=${paymentId}`,
    failUrl: `${base}/api/payments/${provider}/fail?paymentId=${paymentId}`,
    cancelUrl: `${base}/api/payments/${provider}/cancel?paymentId=${paymentId}`,
    ipnUrl: `${base}/api/payments/${provider}/ipn`,
    orderUrl: `${base}/orders/${orderId}`,
  };
}

export const paymentsService = {
  /**
   * Hand off the user to the gateway. Called immediately after
   * `checkoutService.placeOrder` for any non-COD method.
   */
  async kickoff(paymentId: string, args: KickoffArgs): Promise<InitiatedPayment> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { include: { user: true } } },
    });
    if (!payment) throw new NotFoundError('Payment');
    if (payment.status !== PaymentStatus.PENDING) {
      throw new ConflictError('Payment is no longer pending');
    }

    if (payment.method === PaymentMethod.COD) {
      // COD never has a gateway hop. checkoutService already auto-confirmed
      // the order, or left it PENDING awaiting its confirmation fee
      // (verifyCodFee); nothing to redirect to either way.
      return { paymentId: payment.id, redirectUrl: null };
    }

    const urls = buildUrls(args.origin, payment.method, payment.id, payment.orderId);
    const gateway = getGateway(payment.method);

    const initInput: PaymentInitInput = {
      orderId: payment.orderId,
      orderNumber: payment.order.orderNumber,
      paymentId: payment.id,
      amountCents: payment.amountCents,
      customer: {
        name: payment.order.shipRecipient,
        email: payment.order.user.email ?? '',
        phone: payment.order.shipPhone,
      },
      successUrl: urls.successUrl,
      failUrl: urls.failUrl,
      cancelUrl: urls.cancelUrl,
      ipnUrl: urls.ipnUrl,
    };

    const result = await gateway.init(initInput);

    if (result.providerRef) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerRef: result.providerRef,
          rawPayload: (result.rawPayload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });
    }

    return { paymentId: payment.id, redirectUrl: result.redirectUrl || urls.orderUrl };
  },

  /**
   * Apply a normalised gateway callback to the database. Idempotent:
   * once a payment is terminal it's never overwritten, and the order
   * status only advances on the first SUCCEEDED.
   */
  async applyCallback(method: PaymentMethod, outcome: CallbackOutcome) {
    // The customer notification is collected inside the transaction but
    // sent only after it commits (never email about a rolled-back state).
    let notify: {
      email: string | null;
      orderNumber: string;
      totalCents: number;
      succeeded: boolean;
    } | null = null;

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: outcome.paymentId },
      });
      if (!payment) throw new NotFoundError('Payment');
      if (payment.method !== method) {
        throw new BadRequestError('Method mismatch on payment callback');
      }

      // No-op once terminal.
      if (
        payment.status === PaymentStatus.SUCCEEDED ||
        payment.status === PaymentStatus.FAILED ||
        payment.status === PaymentStatus.CANCELLED ||
        payment.status === PaymentStatus.REFUNDED
      ) {
        return payment;
      }

      // A SUCCEEDED callback whose independently-verified amount doesn't
      // match what we charged is treated as FAILED (which restocks below):
      // otherwise a tampered gateway hop could pay less than the order
      // total and still confirm it. `verifiedAmountCents` is only set on
      // live validation paths — sandbox callbacks carry no independent
      // amount and are unaffected.
      let effectiveStatus = outcome.status;
      let amountMismatch = false;
      if (
        outcome.status === PaymentStatus.SUCCEEDED &&
        outcome.verifiedAmountCents !== undefined &&
        outcome.verifiedAmountCents !== payment.amountCents
      ) {
        amountMismatch = true;
        effectiveStatus = PaymentStatus.FAILED;
        log.error('payments.callback.amount_mismatch', {
          paymentId: payment.id,
          expectedCents: payment.amountCents,
          gotCents: outcome.verifiedAmountCents,
        });
      }

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: effectiveStatus,
          providerRef: outcome.providerRef,
          rawPayload: (outcome.rawPayload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });

      if (effectiveStatus === PaymentStatus.SUCCEEDED) {
        const order = await tx.order.update({
          where: { id: payment.orderId },
          data: { status: OrderStatus.CONFIRMED },
          select: { orderNumber: true, totalCents: true, user: { select: { email: true } } },
        });
        await tx.orderEvent.create({
          data: {
            orderId: payment.orderId,
            status: OrderStatus.CONFIRMED,
            note: `Payment received via ${method}`,
          },
        });
        notify = {
          email: order.user.email,
          orderNumber: order.orderNumber,
          totalCents: order.totalCents,
          succeeded: true,
        };
      } else if (
        effectiveStatus === PaymentStatus.FAILED ||
        effectiveStatus === PaymentStatus.CANCELLED
      ) {
        // Don't auto-cancel the order yet; the customer might retry.
        // Restock so the held inventory isn't lost while they decide.
        const order = await tx.order.findUnique({
          where: { id: payment.orderId },
          include: { items: true, user: { select: { email: true } } },
        });
        if (order) {
          await restockOrderItems(tx, order.items);
          notify = {
            email: order.user.email,
            orderNumber: order.orderNumber,
            totalCents: order.totalCents,
            succeeded: false,
          };
        }
        await tx.orderEvent.create({
          data: {
            orderId: payment.orderId,
            status: OrderStatus.PENDING,
            note: amountMismatch
              ? `Payment rejected via ${method}: amount mismatch; stock restored`
              : `Payment ${effectiveStatus.toLowerCase()} via ${method}; stock restored`,
          },
        });
      }

      log.info('payments.callback.applied', {
        paymentId: updated.id,
        status: updated.status,
        method,
      });
      return updated;
    });

    if (notify) {
      const { email, orderNumber, totalCents, succeeded } = notify;
      void sendMail(email, paymentResultEmail({ orderNumber, totalCents }, succeeded));
    }
    return result;
  },

  /**
   * Customer attaches a manual bank-transfer reference to their
   * pending payment. Status stays PENDING until an admin verifies.
   */
  async submitBankReference(userId: string, paymentId: string, bankRef: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment) throw new NotFoundError('Payment');
    if (payment.order.userId !== userId) throw new ForbiddenError('Not your order');
    if (payment.method !== PaymentMethod.BANK_TRANSFER) {
      throw new BadRequestError('Reference can only be attached to bank transfers');
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new ConflictError('Payment already processed');
    }
    return prisma.payment.update({ where: { id: paymentId }, data: { bankRef } });
  },

  /**
   * Admin verification path. Used for COD on delivery and for
   * manual bank-transfer payments. Outcome SUCCEEDED transitions the
   * order to CONFIRMED (if it isn't already) and emits an audit event.
   */
  async verify(adminId: string, paymentId: string, outcome: 'SUCCEEDED' | 'FAILED', note?: string) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { order: true },
      });
      if (!payment) throw new NotFoundError('Payment');
      if (payment.status !== PaymentStatus.PENDING) {
        throw new ConflictError('Payment already processed');
      }
      // A COD order with an undecided confirmation fee must go through
      // verifyCodFee first (or be confirmed/waived via ordersService.transition).
      if (payment.method === PaymentMethod.COD && payment.feeStatus === CodFeeStatus.PENDING) {
        throw new ConflictError('Verify the confirmation fee first');
      }
      // A rejected fee is a decision already made: the admin either waives it
      // by confirming the order (ordersService.transition) or reopens it.
      if (payment.method === PaymentMethod.COD && payment.feeStatus === CodFeeStatus.REJECTED) {
        throw new ConflictError(
          'The confirmation fee was rejected. Waive it by changing the order status to Confirmed, or decide the fee first.',
        );
      }

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: outcome === 'SUCCEEDED' ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED,
          verifiedById: adminId,
          verifiedAt: new Date(),
        },
      });

      const noteText =
        note ??
        `Payment ${outcome === 'SUCCEEDED' ? 'verified' : 'rejected'} by admin (${payment.method})`;

      if (outcome === 'SUCCEEDED' && payment.order.status === OrderStatus.PENDING) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: OrderStatus.CONFIRMED },
        });
      }

      await tx.orderEvent.create({
        data: {
          orderId: payment.orderId,
          status: outcome === 'SUCCEEDED' ? OrderStatus.CONFIRMED : payment.order.status,
          note: noteText,
          actorId: adminId,
        },
      });

      return updated;
    });
  },

  /** Whether a transaction id is already used (customer txn id or bank ref, case-insensitive). */
  async txnIdExists(txnId: string): Promise<boolean> {
    return (await findPaymentByTxnId(prisma, txnId)) !== null;
  },

  /**
   * Customer attaches the transaction id of their manually-paid COD
   * confirmation fee. Add-only: once set it can't be changed by the customer.
   * Ownership failures are reported as NotFound (no existence leak), and a
   * duplicate id reveals nothing about the other order.
   */
  async submitCustomerTxnId(userId: string, paymentId: string, rawTxnId: string) {
    const txnId = normalizeTxnId(rawTxnId);
    try {
      return await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: { order: true },
        });
        if (!payment || payment.order.userId !== userId) throw new NotFoundError('Payment');
        if (payment.method !== PaymentMethod.COD || payment.feeStatus !== CodFeeStatus.PENDING) {
          throw new ConflictError('No confirmation fee is awaiting a transaction ID');
        }
        if (payment.order.status !== OrderStatus.PENDING) {
          throw new ConflictError('Order is no longer pending');
        }
        if (payment.customerTxnId) throw new ConflictError('Transaction ID already submitted');
        if (await findPaymentByTxnId(tx, txnId)) throw new TxnIdDuplicateError();

        // Atomic add-only write: loses cleanly to a concurrent submit.
        const res = await tx.payment.updateMany({
          where: { id: paymentId, customerTxnId: null, feeStatus: CodFeeStatus.PENDING },
          data: { customerTxnId: txnId, txnSubmittedAt: new Date() },
        });
        if (res.count !== 1) throw new ConflictError('Transaction ID already submitted');

        await tx.orderEvent.create({
          data: {
            orderId: payment.orderId,
            status: payment.order.status,
            note: 'Customer submitted transaction ID',
            actorId: userId,
          },
        });
        return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      });
    } catch (err) {
      // Lost a race on the unique index despite the pre-check.
      if (isTxnIdUniqueViolation(err)) throw new TxnIdDuplicateError();
      throw err;
    }
  },

  /**
   * Admin sets or replaces the transaction id on a fee-unverified COD
   * payment. A duplicate throws TXN_ID_DUPLICATE with the conflicting order's
   * id/number in `meta` (admin-only; `jsonError` serializes it).
   */
  async adminSetTxnId(adminId: string, paymentId: string, rawTxnId: string) {
    const txnId = normalizeTxnId(rawTxnId);
    const duplicate = (order: { id: string; orderNumber: string }) =>
      new TxnIdDuplicateError(`Transaction ID is already used on order ${order.orderNumber}`, {
        existingOrderId: order.id,
        existingOrderNumber: order.orderNumber,
      });

    try {
      return await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: { order: true },
        });
        if (!payment) throw new NotFoundError('Payment');
        if (
          payment.method !== PaymentMethod.COD ||
          (payment.feeStatus !== CodFeeStatus.PENDING &&
            payment.feeStatus !== CodFeeStatus.REJECTED)
        ) {
          throw new ConflictError('Transaction ID can only be set while the fee is unverified');
        }
        if (payment.order.status !== OrderStatus.PENDING) {
          throw new ConflictError('Order is no longer pending');
        }

        // Claim the order row first (no-op CAS, same status) so a concurrent
        // cancel/confirm can't interleave with the payment write.
        const claimed = await claimOrderStatus(tx, payment.order, {
          status: payment.order.status,
        });
        if (!claimed) throw new ConflictError('Order status changed, refresh and retry');

        const existing = await findPaymentByTxnId(tx, txnId, paymentId);
        if (existing) throw duplicate(existing.order);

        const res = await tx.payment.updateMany({
          where: {
            id: paymentId,
            feeStatus: { in: [CodFeeStatus.PENDING, CodFeeStatus.REJECTED] },
          },
          data: { customerTxnId: txnId, txnSubmittedAt: new Date() },
        });
        if (res.count !== 1) throw new ConflictError('Confirmation fee already processed');

        await tx.orderEvent.create({
          data: {
            orderId: payment.orderId,
            status: payment.order.status,
            note: payment.customerTxnId
              ? `Admin replaced transaction ID (was ${payment.customerTxnId})`
              : 'Admin set transaction ID',
            actorId: adminId,
          },
        });
        return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      });
    } catch (err) {
      if (isTxnIdUniqueViolation(err)) {
        const existing = await findPaymentByTxnId(prisma, txnId, paymentId);
        throw existing ? duplicate(existing.order) : new TxnIdDuplicateError();
      }
      throw err;
    }
  },

  /**
   * Admin decision on a COD confirmation fee (paid manually, outside the
   * system). VERIFIED confirms the order; REJECTED leaves it PENDING.
   * Lock order matches `ordersService.transition` (order row, then payment
   * row) so the two can't deadlock: both outcomes claim the order row first
   * (REJECTED with a no-op CAS on the same status), then CAS the payment, so
   * exactly one concurrent caller wins. `adminSetTxnId` takes the same
   * order-then-payment path.
   */
  async verifyCodFee(
    adminId: string,
    paymentId: string,
    outcome: 'VERIFIED' | 'REJECTED',
    note?: string,
  ) {
    let notify: { email: string | null; orderNumber: string } | null = null;

    const updated = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { order: { include: { user: { select: { email: true } } } } },
      });
      if (!payment) throw new NotFoundError('Payment');
      if (payment.method !== PaymentMethod.COD) {
        throw new BadRequestError('Confirmation fee only applies to COD payments');
      }
      if (payment.feeStatus !== CodFeeStatus.PENDING) {
        throw new ConflictError('Confirmation fee already processed');
      }
      if (payment.order.status !== OrderStatus.PENDING) {
        throw new ConflictError('Order is no longer pending');
      }

      // Claim the order row before touching the payment: VERIFIED moves it to
      // CONFIRMED, REJECTED is a no-op CAS (same status) that still serializes
      // against a concurrent cancel, so a CANCELLED order can't end up REJECTED.
      const claimed = await claimOrderStatus(tx, payment.order, {
        status: outcome === 'VERIFIED' ? OrderStatus.CONFIRMED : payment.order.status,
      });
      if (!claimed) throw new ConflictError('Order status changed, refresh and retry');

      const res = await tx.payment.updateMany({
        where: { id: paymentId, feeStatus: CodFeeStatus.PENDING },
        data:
          outcome === 'VERIFIED'
            ? {
                feeStatus: CodFeeStatus.VERIFIED,
                feeVerifiedById: adminId,
                feeVerifiedAt: new Date(),
              }
            : { feeStatus: CodFeeStatus.REJECTED },
      });
      if (res.count !== 1) throw new ConflictError('Confirmation fee already processed');

      const base =
        outcome === 'VERIFIED'
          ? 'COD confirmation fee verified by admin'
          : 'COD confirmation fee rejected by admin';
      await tx.orderEvent.create({
        data: {
          orderId: payment.orderId,
          status: outcome === 'VERIFIED' ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
          note: note ? `${base}: ${note}` : base,
          actorId: adminId,
        },
      });

      if (outcome === 'VERIFIED') {
        notify = { email: payment.order.user.email, orderNumber: payment.order.orderNumber };
      }
      return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    });

    // Fire-and-forget, after commit: a failed email never fails the verify.
    if (notify) {
      const { email, orderNumber } = notify;
      void sendMail(email, orderStatusEmail({ orderNumber }, OrderStatus.CONFIRMED));
    }
    return updated;
  },

  /**
   * Admin listing for the payment-verification screen. Returns
   * payments awaiting human action, newest first.
   */
  listPendingForVerification() {
    return prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        method: { in: [PaymentMethod.COD, PaymentMethod.BANK_TRANSFER] },
        // A cancelled order has nothing left to verify.
        order: { status: { not: OrderStatus.CANCELLED } },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalCents: true,
            shipRecipient: true,
            shipPhone: true,
            shipCity: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  },
};
