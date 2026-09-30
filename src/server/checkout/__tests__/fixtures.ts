/**
 * Live-DB fixtures for checkout tests (not a test file). Every row uses a
 * random suffix; ids are tracked so `cleanupCheckoutFixtures` can remove them.
 */
import { CouponType, PublishStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';

const createdUserIds: string[] = [];
const createdProductIds: string[] = [];
const createdBrandIds: string[] = [];
const createdCouponIds: string[] = [];

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

export interface CheckoutFixtureOptions {
  stock: number;
  cartQty: number;
  /** When set, creates an active coupon with this perUserLimit. */
  couponPerUserLimit?: number;
}

/** Creates a user + address + cart (qty of `variant`) and tracks the user for cleanup. */
async function createShopper(variantId: string, cartQty: number) {
  const suffix = rand();
  const user = await prisma.user.create({
    data: { email: `checkout-test-${suffix}@example.com`, name: 'Checkout Test' },
  });
  createdUserIds.push(user.id);

  const address = await prisma.address.create({
    data: {
      userId: user.id,
      recipientName: 'Checkout Test',
      recipientPhone: '01700000000',
      line1: 'Test Lane 1',
      city: 'Dhaka',
    },
  });

  const cart = await prisma.cart.create({
    data: { userId: user.id, items: { create: [{ variantId, quantity: cartQty }] } },
  });

  return { user, address, cart };
}

export async function createCheckoutFixture(opts: CheckoutFixtureOptions) {
  const suffix = rand();

  const brand = await prisma.brand.create({
    data: { slug: `checkout-test-brand-${suffix}`, name: `Checkout Test Brand ${suffix}` },
  });
  createdBrandIds.push(brand.id);

  const product = await prisma.product.create({
    data: {
      slug: `checkout-test-product-${suffix}`,
      name: `Checkout Test Product ${suffix}`,
      description: 'test fixture',
      brandId: brand.id,
      status: PublishStatus.PUBLISHED,
    },
  });
  createdProductIds.push(product.id);

  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `CHECKOUT-TEST-${suffix}`,
      buyingPriceCents: 50_000,
      sellingPriceCents: 100_000,
      stock: opts.stock,
      isActive: true,
    },
  });

  let coupon: Awaited<ReturnType<typeof prisma.coupon.create>> | null = null;
  if (opts.couponPerUserLimit !== undefined) {
    coupon = await prisma.coupon.create({
      data: {
        code: `CHKTEST${suffix}`.toUpperCase(),
        type: CouponType.FIXED,
        value: 1_000,
        perUserLimit: opts.couponPerUserLimit,
        isActive: true,
      },
    });
    createdCouponIds.push(coupon.id);
  }

  const first = await createShopper(variant.id, opts.cartQty);

  return {
    brand,
    product,
    variant,
    coupon,
    user: first.user,
    address: first.address,
    /** Another user with their own cart against the SAME variant. */
    addShopper: (cartQty: number) => createShopper(variant.id, cartQty),
  };
}

export async function cleanupCheckoutFixtures() {
  const userIds = createdUserIds.splice(0);
  const productIds = createdProductIds.splice(0);
  const brandIds = createdBrandIds.splice(0);
  const couponIds = createdCouponIds.splice(0);

  // Orders cascade items/payments/events; they must go before users/coupons.
  await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
  // CartItem.variant is restrict, so carts (cascade items) go before products.
  await prisma.cart.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.coupon.deleteMany({ where: { id: { in: couponIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.brand.deleteMany({ where: { id: { in: brandIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
