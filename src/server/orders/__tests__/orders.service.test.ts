/**
 * Live-DB tests (same tradeoff as rate-limit.test.ts: no Prisma-mocking
 * convention exists in this repo, so these run against the DATABASE_URL
 * database). Fixtures are randomised per test and cleaned up after.
 */
import { OrderStatus } from '@prisma/client';
import { afterEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { ConflictError } from '@/server/common/errors';

import { ordersService } from '../orders.service';

const TEST_TIMEOUT = 60_000;

const createdUserIds: string[] = [];
const createdOrderIds: string[] = [];
const createdProductIds: string[] = [];
const createdBrandIds: string[] = [];

async function createOrderFixture(opts: { orderStatus: OrderStatus; stock?: number }) {
  const suffix = Math.random().toString(36).slice(2, 10);
  const stock = opts.stock ?? 5;
  const quantity = 2;

  const user = await prisma.user.create({
    data: { email: `orders-test-${suffix}@example.com`, name: 'Orders Test' },
  });
  createdUserIds.push(user.id);

  const address = await prisma.address.create({
    data: {
      userId: user.id,
      recipientName: 'Orders Test',
      recipientPhone: '01700000000',
      line1: 'Test Lane 1',
      city: 'Dhaka',
    },
  });

  const brand = await prisma.brand.create({
    data: { slug: `orders-test-brand-${suffix}`, name: `Orders Test Brand ${suffix}` },
  });
  createdBrandIds.push(brand.id);

  const product = await prisma.product.create({
    data: {
      slug: `orders-test-product-${suffix}`,
      name: 'Orders Test Product',
      description: 'test fixture',
      brandId: brand.id,
    },
  });
  createdProductIds.push(product.id);

  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `ORDERS-TEST-${suffix}`,
      buyingPriceCents: 50_000,
      sellingPriceCents: 100_000,
      stock,
    },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: `ORDERS-TEST-${suffix}`,
      userId: user.id,
      addressId: address.id,
      status: opts.orderStatus,
      shipRecipient: 'Orders Test',
      shipPhone: '01700000000',
      shipLine1: 'Test Lane 1',
      shipCity: 'Dhaka',
      shipCountry: 'BD',
      subtotalCents: 200_000,
      totalCents: 200_000,
      items: {
        create: [
          {
            variantId: variant.id,
            productId: product.id,
            productName: 'Orders Test Product',
            sku: variant.sku,
            buyingPriceCents: 50_000,
            unitPriceCents: 100_000,
            quantity,
          },
        ],
      },
    },
  });
  createdOrderIds.push(order.id);

  return { user, order, variant, quantity, stock };
}

afterEach(async () => {
  // Orders reference User/Address without cascade, so they go first;
  // products cascade their variants, users cascade their addresses.
  await prisma.order.deleteMany({ where: { id: { in: createdOrderIds.splice(0) } } });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds.splice(0) } } });
  await prisma.brand.deleteMany({ where: { id: { in: createdBrandIds.splice(0) } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds.splice(0) } } });
}, TEST_TIMEOUT);

describe('ordersService.transition', () => {
  it(
    'rejects transitions not in the allowed map',
    async () => {
      const { user, order } = await createOrderFixture({ orderStatus: OrderStatus.DELIVERED });

      await expect(
        ordersService.transition(user.id, order.id, OrderStatus.PENDING),
      ).rejects.toBeInstanceOf(ConflictError);

      const cancelled = await createOrderFixture({ orderStatus: OrderStatus.CANCELLED });
      await expect(
        ordersService.transition(user.id, cancelled.order.id, OrderStatus.CONFIRMED),
      ).rejects.toBeInstanceOf(ConflictError);
    },
    TEST_TIMEOUT,
  );

  it(
    'allows a mapped transition and records an order event',
    async () => {
      const { user, order } = await createOrderFixture({ orderStatus: OrderStatus.PENDING });

      const updated = await ordersService.transition(user.id, order.id, OrderStatus.CONFIRMED);
      expect(updated.status).toBe(OrderStatus.CONFIRMED);

      const events = await prisma.orderEvent.findMany({ where: { orderId: order.id } });
      expect(events.some((e) => e.status === OrderStatus.CONFIRMED)).toBe(true);
    },
    TEST_TIMEOUT,
  );

  it(
    'restocks items when an admin cancels',
    async () => {
      const { user, order, variant, quantity, stock } = await createOrderFixture({
        orderStatus: OrderStatus.PENDING,
      });

      const updated = await ordersService.transition(
        user.id,
        order.id,
        OrderStatus.CANCELLED,
        'test cancel',
      );
      expect(updated.status).toBe(OrderStatus.CANCELLED);

      const refreshed = await prisma.productVariant.findUniqueOrThrow({
        where: { id: variant.id },
      });
      expect(refreshed.stock).toBe(stock + quantity);
    },
    TEST_TIMEOUT,
  );

  it(
    'does not restock on non-cancel transitions',
    async () => {
      const { user, order, variant, stock } = await createOrderFixture({
        orderStatus: OrderStatus.CONFIRMED,
      });

      await ordersService.transition(user.id, order.id, OrderStatus.PROCESSING);

      const refreshed = await prisma.productVariant.findUniqueOrThrow({
        where: { id: variant.id },
      });
      expect(refreshed.stock).toBe(stock);
    },
    TEST_TIMEOUT,
  );
});
