import { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/server/common/errors';
import { log } from '@/server/common/logger';
import type { InitiatedPayment } from '@/contracts/payments';

import type { CallbackOutcome, PaymentInitInput } from './gateway.interface';
import { getGateway } from './registry';

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
      // COD never has a gateway hop. The order was already auto-confirmed
      // in checkoutService; nothing to redirect to.
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
    return prisma.$transaction(async (tx) => {
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

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: outcome.status,
          providerRef: outcome.providerRef,
          rawPayload: (outcome.rawPayload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });

      if (outcome.status === PaymentStatus.SUCCEEDED) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: OrderStatus.CONFIRMED },
        });
        await tx.orderEvent.create({
          data: {
            orderId: payment.orderId,
            status: OrderStatus.CONFIRMED,
            note: `Payment received via ${method}`,
          },
        });
      } else if (outcome.status === PaymentStatus.FAILED || outcome.status === PaymentStatus.CANCELLED) {
        // Don't auto-cancel the order yet; the customer might retry.
        await tx.orderEvent.create({
          data: {
            orderId: payment.orderId,
            status: OrderStatus.PENDING,
            note: `Payment ${outcome.status.toLowerCase()} via ${method}`,
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

  /**
   * Admin listing for the payment-verification screen. Returns
   * payments awaiting human action, newest first.
   */
  listPendingForVerification() {
    return prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        method: { in: [PaymentMethod.COD, PaymentMethod.BANK_TRANSFER] },
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
