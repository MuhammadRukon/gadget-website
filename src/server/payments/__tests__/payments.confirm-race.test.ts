/**
 * Live-DB tests for the order-confirmation compare-and-set shared by
 * `paymentsService.verify` (admin) and `paymentsService.applyCallback`
 * (gateway): a confirm must lose cleanly to a concurrent cancel instead of
 * flipping a CANCELLED order back to CONFIRMED.
 *
 * Orders/payments are hand-built via `createManualOrder`, so these never
 * touch the PaymentSettings singleton.
 */
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/lib/prisma';
import { ConflictError } from '@/server/common/errors';
import {
  cleanupCheckoutFixtures,
  createAdminUser,
  createManualOrder,
  eventsFor,
} from '@/server/checkout/__tests__/fixtures';
import { cancelOrderInTx, ordersService } from '@/server/orders/orders.service';

import { paymentsService } from '../payments.service';

const ROUNDS = 8;

/**
 * Starts `a` and `b` in (nearly) the same tick, with a random 0-12 ms head
 * start for one side, so across rounds each side wins sometimes.
 */
function raceStaggered<A, B>(a: () => Promise<A>, b: () => Promise<B>) {
  const aDelay = Math.random() < 0.5 ? Math.random() * 12 : 0;
  const bDelay = aDelay === 0 ? Math.random() * 12 : 0;
  const later = <T>(ms: number, fn: () => Promise<T>) =>
    ms === 0 ? fn() : new Promise<T>((r) => setTimeout(r, ms)).then(fn);
  return Promise.allSettled([later(aDelay, a), later(bDelay, b)]) as Promise<
    [PromiseSettledResult<A>, PromiseSettledResult<B>]
  >;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanupCheckoutFixtures();
});

function bankOrder(overrides: Parameters<typeof createManualOrder>[0] = {}) {
  return createManualOrder({ method: PaymentMethod.BANK_TRANSFER, ...overrides });
}

function gatewayOrder(overrides: Parameters<typeof createManualOrder>[0] = {}) {
  return createManualOrder({ method: PaymentMethod.SSLCOMMERZ, ...overrides });
}

function succeeded(paymentId: string, ref = 'ref') {
  return {
    paymentId,
    status: PaymentStatus.SUCCEEDED,
    providerRef: `${ref}-${paymentId}`,
    rawPayload: {},
  };
}

/**
 * Holds an open transaction that has cancelled the order (row locked, not yet
 * committed), starts `action`, then commits. The action reads the order as
 * still PENDING and only then blocks on the order row, so an unguarded
 * `order.update` would flip the CANCELLED order back to CONFIRMED.
 */
async function actionRacingCancel(orderId: string, action: () => Promise<unknown>) {
  let pending: Promise<unknown> = Promise.resolve();
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
    const ok = await cancelOrderInTx(tx, order, {
      reason: 'race',
      event: { note: 'cancelled in race test' },
    });
    expect(ok).toBe(true);
    pending = action().then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    // Let the action run up to its (blocked) order claim.
    await new Promise((r) => setTimeout(r, 400));
  });
  return (await pending) as { value?: unknown; error?: unknown };
}

/** Warn-level structured log lines emitted while the spy was installed. */
function warnMessages(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.map((call: unknown[]) => JSON.parse(String(call[0])).message as string);
}

describe('paymentsService.verify racing an order cancel', () => {
  it('loses to a cancel that holds the order row: ConflictError, payment stays PENDING, order stays CANCELLED', async () => {
    const admin = await createAdminUser();
    const { order, payment } = await bankOrder();

    const res = await actionRacingCancel(order.id, () =>
      paymentsService.verify(admin.id, payment.id, 'SUCCEEDED'),
    );

    expect(res.error).toBeInstanceOf(ConflictError);
    expect((res.error as Error).message).toBe('Order is no longer pending');
    const pay = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(pay.status).toBe(PaymentStatus.PENDING);
    expect(pay.verifiedById).toBeNull();
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe(OrderStatus.CANCELLED);
    const events = await eventsFor(order.id);
    expect(events.some((e) => e.status === OrderStatus.CONFIRMED)).toBe(false);
  });

  it(`never leaves a CONFIRMED-after-CANCELLED order (${ROUNDS} concurrent rounds)`, async () => {
    const admin = await createAdminUser();
    const tally = { verifyWon: 0, cancelWon: 0, serial: 0 };

    for (let round = 0; round < ROUNDS; round++) {
      const { userId, order, payment } = await bankOrder();

      const [verified, cancelled] = await raceStaggered(
        () => paymentsService.verify(admin.id, payment.id, 'SUCCEEDED'),
        () => ordersService.cancelByCustomer(userId, order.id, 'race'),
      );

      // Exactly one side may fail, and only with the conflict (never a crash).
      for (const r of [verified, cancelled]) {
        if (r.status === 'rejected') expect(r.reason).toBeInstanceOf(ConflictError);
      }
      expect([verified, cancelled].some((r) => r.status === 'fulfilled')).toBe(true);

      const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      const pay = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      const events = await eventsFor(order.id);

      // The payment status is exactly the verify outcome.
      expect(pay.status).toBe(
        verified.status === 'fulfilled' ? PaymentStatus.SUCCEEDED : PaymentStatus.PENDING,
      );
      // A cancel that succeeded is final: the order can never end CONFIRMED
      // after it (event timestamps are transaction-start times, so the
      // outcome, not event order, is what proves the sequence).
      expect(row.status).toBe(
        cancelled.status === 'fulfilled' ? OrderStatus.CANCELLED : OrderStatus.CONFIRMED,
      );
      expect(events.filter((e) => e.status === OrderStatus.CANCELLED)).toHaveLength(
        cancelled.status === 'fulfilled' ? 1 : 0,
      );
      expect(events.filter((e) => e.status === OrderStatus.CONFIRMED)).toHaveLength(
        verified.status === 'fulfilled' ? 1 : 0,
      );

      if (verified.status === 'fulfilled' && cancelled.status === 'fulfilled') tally.serial++;
      else if (verified.status === 'fulfilled') tally.verifyWon++;
      else tally.cancelWon++;
    }
    // Surfaced in the test output so the evidence shows the race was exercised.
    console.info('verify-vs-cancel rounds', JSON.stringify(tally));
  });

  it('two concurrent verifies (SUCCEEDED vs FAILED): exactly one wins and the state matches it', async () => {
    const admin = await createAdminUser();

    for (let round = 0; round < ROUNDS; round++) {
      const { order, payment } = await bankOrder();

      const [ok, rejected] = await Promise.allSettled([
        paymentsService.verify(admin.id, payment.id, 'SUCCEEDED'),
        paymentsService.verify(admin.id, payment.id, 'FAILED'),
      ]);

      expect([ok, rejected].filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const loser = [ok, rejected].find((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(loser?.reason).toBeInstanceOf(ConflictError);

      const pay = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(pay.status).toBe(ok.status === 'fulfilled' ? 'SUCCEEDED' : 'FAILED');
      expect(row.status).toBe(
        ok.status === 'fulfilled' ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
      );
      expect(await eventsFor(order.id)).toHaveLength(1);
    }
  });
});

describe('paymentsService.verify unchanged paths', () => {
  it('SUCCEEDED on an already-CONFIRMED order: payment SUCCEEDED, order stays CONFIRMED, one admin event', async () => {
    const admin = await createAdminUser();
    const { order, payment } = await bankOrder({ orderStatus: OrderStatus.CONFIRMED });

    const updated = await paymentsService.verify(admin.id, payment.id, 'SUCCEEDED', 'cash in hand');

    expect(updated.status).toBe(PaymentStatus.SUCCEEDED);
    expect(updated.verifiedById).toBe(admin.id);
    expect(updated.verifiedAt).not.toBeNull();
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe(OrderStatus.CONFIRMED);
    const events = await eventsFor(order.id);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe(OrderStatus.CONFIRMED);
    expect(events[0].actorId).toBe(admin.id);
    expect(events[0].note).toBe('cash in hand');
  });

  it('SUCCEEDED on a PENDING order confirms it with one admin-attributed event', async () => {
    const admin = await createAdminUser();
    const { order, payment } = await bankOrder();

    await paymentsService.verify(admin.id, payment.id, 'SUCCEEDED');

    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe(OrderStatus.CONFIRMED);
    const events = await eventsFor(order.id);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe(OrderStatus.CONFIRMED);
    expect(events[0].actorId).toBe(admin.id);
    expect(events[0].note).toContain('verified by admin');
  });

  it('FAILED on a PENDING order leaves it PENDING and records the rejection', async () => {
    const admin = await createAdminUser();
    const { order, payment } = await bankOrder();

    const updated = await paymentsService.verify(admin.id, payment.id, 'FAILED');

    expect(updated.status).toBe(PaymentStatus.FAILED);
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe(OrderStatus.PENDING);
    const events = await eventsFor(order.id);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe(OrderStatus.PENDING);
    expect(events[0].note).toContain('rejected by admin');
  });

  it('an already-processed payment is a ConflictError', async () => {
    const admin = await createAdminUser();
    const { payment } = await bankOrder();
    await paymentsService.verify(admin.id, payment.id, 'SUCCEEDED');

    await expect(paymentsService.verify(admin.id, payment.id, 'SUCCEEDED')).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe('paymentsService.applyCallback confirming the order', () => {
  it('a SUCCEEDED callback racing a cancel: payment SUCCEEDED, order stays CANCELLED, warning logged', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { order, payment } = await gatewayOrder();

    const res = await actionRacingCancel(order.id, () =>
      paymentsService.applyCallback(PaymentMethod.SSLCOMMERZ, succeeded(payment.id)),
    );

    // The gateway still gets a clean answer (no error loop)...
    expect(res.error).toBeUndefined();
    expect((res.value as { status: PaymentStatus }).status).toBe(PaymentStatus.SUCCEEDED);
    // ...the payment is recorded, but the cancelled order is not resurrected.
    const pay = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(pay.status).toBe(PaymentStatus.SUCCEEDED);
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe(OrderStatus.CANCELLED);
    const events = await eventsFor(order.id);
    expect(events.some((e) => e.status === OrderStatus.CONFIRMED)).toBe(false);
    expect(warnMessages(warn)).toContain('payments.callback.order_not_pending');
  });

  it(`never leaves a CONFIRMED-after-CANCELLED order (${ROUNDS} concurrent rounds)`, async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tally = { callbackWon: 0, cancelWon: 0, serial: 0 };

    for (let round = 0; round < ROUNDS; round++) {
      const { userId, order, payment } = await gatewayOrder();

      const [callback, cancelled] = await raceStaggered(
        () => paymentsService.applyCallback(PaymentMethod.SSLCOMMERZ, succeeded(payment.id)),
        () => ordersService.cancelByCustomer(userId, order.id, 'race'),
      );

      // The callback never errors; the cancel may only lose with the conflict.
      expect(callback.status).toBe('fulfilled');
      if (cancelled.status === 'rejected') expect(cancelled.reason).toBeInstanceOf(ConflictError);

      const pay = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      const events = await eventsFor(order.id);

      expect(pay.status).toBe(PaymentStatus.SUCCEEDED);
      // A cancel that succeeded is final; a cancel that lost left it CONFIRMED.
      expect(row.status).toBe(
        cancelled.status === 'fulfilled' ? OrderStatus.CANCELLED : OrderStatus.CONFIRMED,
      );
      expect(events.filter((e) => e.status === OrderStatus.CANCELLED)).toHaveLength(
        cancelled.status === 'fulfilled' ? 1 : 0,
      );

      const confirmedEvents = events.filter((e) => e.status === OrderStatus.CONFIRMED).length;
      expect(confirmedEvents).toBeLessThanOrEqual(1);
      if (cancelled.status === 'rejected') expect(confirmedEvents).toBe(1);
      if (cancelled.status === 'fulfilled' && confirmedEvents === 1) tally.serial++;
      else if (cancelled.status === 'fulfilled') tally.cancelWon++;
      else tally.callbackWon++;
    }
    console.info('callback-vs-cancel rounds', JSON.stringify(tally));
  });

  it('on an order that is not PENDING (already CANCELLED): payment recorded, order untouched, warning logged', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { order, payment } = await gatewayOrder({ orderStatus: OrderStatus.CANCELLED });

    const applied = await paymentsService.applyCallback(
      PaymentMethod.SSLCOMMERZ,
      succeeded(payment.id),
    );

    expect(applied.status).toBe(PaymentStatus.SUCCEEDED);
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe(OrderStatus.CANCELLED);
    expect(await eventsFor(order.id)).toHaveLength(0);
    expect(warnMessages(warn)).toContain('payments.callback.order_not_pending');
  });

  it('on a PENDING order: confirms it with a "Payment received" event and no warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { order, payment } = await gatewayOrder();

    await paymentsService.applyCallback(PaymentMethod.SSLCOMMERZ, succeeded(payment.id));

    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe(OrderStatus.CONFIRMED);
    const events = await eventsFor(order.id);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe(OrderStatus.CONFIRMED);
    expect(events[0].actorId).toBeNull();
    expect(events[0].note).toBe(`Payment received via ${PaymentMethod.SSLCOMMERZ}`);
    expect(warnMessages(warn)).not.toContain('payments.callback.order_not_pending');
  });

  it('a repeated SUCCEEDED callback is a no-op: one CONFIRMED event, status unchanged', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { order, payment } = await gatewayOrder();

    const first = await paymentsService.applyCallback(
      PaymentMethod.SSLCOMMERZ,
      succeeded(payment.id, 'first'),
    );
    const replay = await paymentsService.applyCallback(
      PaymentMethod.SSLCOMMERZ,
      succeeded(payment.id, 'replay'),
    );

    expect(first.status).toBe(PaymentStatus.SUCCEEDED);
    expect(replay.status).toBe(PaymentStatus.SUCCEEDED);
    expect(replay.providerRef).toBe(first.providerRef);
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe(OrderStatus.CONFIRMED);
    expect(await eventsFor(order.id)).toHaveLength(1);
  });

  it('two concurrent SUCCEEDED callbacks: both resolve, exactly one CONFIRMED event', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (let round = 0; round < ROUNDS; round++) {
      const { order, payment } = await gatewayOrder();

      const results = await Promise.allSettled([
        paymentsService.applyCallback(PaymentMethod.SSLCOMMERZ, succeeded(payment.id, 'a')),
        paymentsService.applyCallback(PaymentMethod.SSLCOMMERZ, succeeded(payment.id, 'b')),
      ]);

      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
      const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      const pay = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(row.status).toBe(OrderStatus.CONFIRMED);
      expect(pay.status).toBe(PaymentStatus.SUCCEEDED);
      const events = await eventsFor(order.id);
      expect(events.filter((e) => e.status === OrderStatus.CONFIRMED)).toHaveLength(1);
    }
  });
});
