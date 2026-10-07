/**
 * `listPendingForVerification` feeds the admin payments page. Live-DB test;
 * does not touch the PaymentSettings singleton, so it runs in the parallel project.
 */
import { CodFeeStatus, OrderStatus, PaymentMethod } from '@prisma/client';
import { afterEach, describe, expect, it } from 'vitest';

import {
  cleanupCheckoutFixtures,
  createManualOrder,
} from '@/server/checkout/__tests__/fixtures';

import { paymentsService } from '../payments.service';

const TEST_TIMEOUT = 60_000;

afterEach(async () => {
  await cleanupCheckoutFixtures();
}, TEST_TIMEOUT);

describe('paymentsService.listPendingForVerification', () => {
  it(
    'returns customerTxnId, feeCents and feeStatus for a fee-pending COD payment',
    async () => {
      const { payment, order } = await createManualOrder({
        method: PaymentMethod.COD,
        feeStatus: CodFeeStatus.PENDING,
        feeCents: 10_000,
        customerTxnId: 'LISTTXN1234',
      });

      const items = await paymentsService.listPendingForVerification();
      const row = items.find((p) => p.id === payment.id);

      expect(row).toBeDefined();
      expect(row?.customerTxnId).toBe('LISTTXN1234');
      expect(row?.feeCents).toBe(10_000);
      expect(row?.feeStatus).toBe(CodFeeStatus.PENDING);
      expect(row?.order.orderNumber).toBe(order.orderNumber);
    },
    TEST_TIMEOUT,
  );

  it(
    'a plain COD payment reports feeStatus NONE, feeCents 0 and no txn id',
    async () => {
      const { payment } = await createManualOrder({ method: PaymentMethod.COD });

      const row = (await paymentsService.listPendingForVerification()).find(
        (p) => p.id === payment.id,
      );

      expect(row?.feeStatus).toBe(CodFeeStatus.NONE);
      expect(row?.feeCents).toBe(0);
      expect(row?.customerTxnId).toBeNull();
    },
    TEST_TIMEOUT,
  );

  it(
    'excludes payments of cancelled orders',
    async () => {
      const live = await createManualOrder({ method: PaymentMethod.COD });
      const cancelled = await createManualOrder({
        method: PaymentMethod.COD,
        orderStatus: OrderStatus.CANCELLED,
      });

      const ids = (await paymentsService.listPendingForVerification()).map((p) => p.id);

      expect(ids).toContain(live.payment.id);
      expect(ids).not.toContain(cancelled.payment.id);
    },
    TEST_TIMEOUT,
  );
});
