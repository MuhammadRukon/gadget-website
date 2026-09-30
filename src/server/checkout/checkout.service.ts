import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { randomBytes } from 'crypto';

import { prisma } from '@/lib/prisma';
import type { CheckoutInput, CheckoutQuote, StockConflictMeta } from '@/contracts/checkout';
import { applyDiscount } from '@/server/common/money';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '@/server/common/errors';
import { couponsService } from '@/server/coupons/coupons.service';
import { cancelOrderInTx } from '@/server/orders/orders.service';

import { computeShippingCents } from './shipping';

interface QuoteInput {
  userId: string;
  addressId: string;
  couponCode?: string;
}

function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = randomBytes(3).toString('hex').toUpperCase();
  return `T-${ts}-${rnd}`;
}

interface ResolvedCartLine {
  variantId: string;
  variantName: string | null;
  productId: string;
  productName: string;
  sku: string;
  imageUrl: string | null;
  unitPriceCents: number;
  buyingPriceCents: number;
  quantity: number;
}

/** Total quantity per variant (a variant may appear on several lines). */
function groupLinesByVariantId(
  lines: Pick<ResolvedCartLine, 'variantId' | 'productName' | 'quantity'>[],
) {
  const byVariantId = new Map<string, { quantity: number; productName: string }>();
  for (const { variantId, productName, quantity } of lines) {
    const group = byVariantId.get(variantId);
    if (group) group.quantity += quantity;
    else byVariantId.set(variantId, { quantity, productName });
  }
  return byVariantId;
}

function stockConflict(
  variantId: string,
  productName: string,
  reason: StockConflictMeta['reason'],
): ConflictError {
  const message =
    reason === 'unavailable'
      ? `"${productName}" is no longer available`
      : `Not enough stock for "${productName}"`;
  const meta: StockConflictMeta = { variantId, productName, reason };
  return new ConflictError(message, meta);
}

/** Throws a stock ConflictError if a cart line can't be fulfilled right now. */
function assertLineAvailable(item: {
  quantity: number;
  variant: {
    id: string;
    isActive: boolean;
    stock: number;
    product: { name: string; status: string };
  };
}) {
  const { variant } = item;
  const productName = variant.product.name;
  if (!variant.isActive || variant.product.status !== 'PUBLISHED') {
    throw stockConflict(variant.id, productName, 'unavailable');
  }
  if (variant.stock < item.quantity) {
    throw stockConflict(variant.id, productName, 'insufficient_stock');
  }
}

async function loadAddressOrThrow(userId: string, addressId: string) {
  const address = await prisma.address.findFirst({ where: { id: addressId, userId } });
  if (!address) throw new NotFoundError('Address');
  return address;
}

async function loadCartLines(userId: string): Promise<ResolvedCartLine[]> {
  const items = await prisma.cartItem.findMany({
    where: { cart: { userId } },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              status: true,
              images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (items.length === 0) {
    throw new BadRequestError('Cart is empty');
  }

  return items.map((item) => {
    const v = item.variant;
    const p = v.product;
    assertLineAvailable(item);
    return {
      variantId: v.id,
      variantName: v.name,
      productId: p.id,
      productName: p.name,
      sku: v.sku,
      imageUrl: p.images[0]?.url ?? null,
      unitPriceCents: applyDiscount(v.sellingPriceCents, v.discountCents),
      buyingPriceCents: v.buyingPriceCents,
      quantity: item.quantity,
    };
  });
}

export const checkoutService = {
  async quote(input: QuoteInput): Promise<CheckoutQuote> {
    const address = await loadAddressOrThrow(input.userId, input.addressId);
    const lines = await loadCartLines(input.userId);
    const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);

    let discountCents = 0;
    let couponCode: string | null = null;
    if (input.couponCode) {
      const validated = await couponsService.validate({
        code: input.couponCode,
        userId: input.userId,
        subtotalCents,
      });
      discountCents = validated.discountCents;
      couponCode = validated.code;
    }

    const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
    const shippingCents = computeShippingCents({
      city: address.city,
      subtotalCents: subtotalCents - discountCents,
      itemCount,
    });

    const totalCents = Math.max(0, subtotalCents - discountCents) + shippingCents;
    return { subtotalCents, discountCents, shippingCents, totalCents, couponCode };
  },

  /**
   * Place an order. Single Prisma transaction does:
   *   1. Consume the cart first (count-checked delete) to serialize
   *      duplicate submits for the same user.
   *   2. Re-validate every line against current availability/stock to
   *      avoid overselling between quote and confirm.
   *   3. Re-validate the coupon and compute totals + shipping.
   *   4. Create the `Order`, snapshotting every line into `OrderItem`
   *      (price, name, sku, image, buying price) so future catalog
   *      changes never alter past orders.
   *   5. Decrement variant stock atomically (in sorted variantId order);
   *      the conditional update is the real oversell guard.
   *   6. Bump coupon `usedCount` if applied.
   *   7. Create the `Payment` row in PENDING (COD is auto-confirmed at the
   *      order level; payment itself stays PENDING until cash is collected).
   *   8. Append an `OrderEvent` for audit.
   * Anything failing rolls the whole thing back atomically.
   */
  async placeOrder(userId: string, input: CheckoutInput) {
    const address = await loadAddressOrThrow(userId, input.addressId);

    return prisma.$transaction(async (tx) => {
      // 1. Read and consume the cart inside the transaction.
      const cartItems = await tx.cartItem.findMany({
        where: { cart: { userId } },
        include: {
          variant: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                  images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
                },
              },
            },
          },
        },
      });
      if (cartItems.length === 0) {
        throw new BadRequestError('Cart is empty');
      }
      // Consume the cart first. A concurrent placeOrder for the same user
      // blocks on these row deletes (READ COMMITTED row locks) and then
      // finds 0 rows, so a double submit can only succeed once.
      const consumed = await tx.cartItem.deleteMany({
        where: { id: { in: cartItems.map((i) => i.id) } },
      });
      if (consumed.count !== cartItems.length) {
        throw new ConflictError('Your cart changed, please review and try again');
      }

      // 2. Re-validate availability and per-line stock.
      for (const item of cartItems) {
        assertLineAvailable(item);
      }

      const lines: ResolvedCartLine[] = cartItems.map((item) => ({
        variantId: item.variant.id,
        variantName: item.variant.name,
        productId: item.variant.product.id,
        productName: item.variant.product.name,
        sku: item.variant.sku,
        imageUrl: item.variant.product.images[0]?.url ?? null,
        unitPriceCents: applyDiscount(item.variant.sellingPriceCents, item.variant.discountCents),
        buyingPriceCents: item.variant.buyingPriceCents,
        quantity: item.quantity,
      }));
      const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);

      // 3. Validate coupon (we re-run inside tx to lock in usedCount).
      let discountCents = 0;
      let couponId: string | null = null;
      let couponCode: string | null = null;
      if (input.couponCode) {
        const validated = await couponsService.validate(
          { code: input.couponCode, userId, subtotalCents },
          tx,
        );
        discountCents = validated.discountCents;
        couponId = validated.id;
        couponCode = validated.code;
      }

      const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
      const shippingCents = computeShippingCents({
        city: address.city,
        subtotalCents: subtotalCents - discountCents,
        itemCount,
      });
      const totalCents = Math.max(0, subtotalCents - discountCents) + shippingCents;

      // 4. Create order with snapshotted address + items.
      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId,
          addressId: address.id,
          status: OrderStatus.PENDING,
          shipRecipient: address.recipientName,
          shipPhone: address.recipientPhone,
          shipLine1: address.line1,
          shipLine2: address.line2,
          shipCity: address.city,
          shipDistrict: address.district,
          shipPostal: address.postalCode,
          shipCountry: address.country,
          subtotalCents,
          discountCents,
          shippingCents,
          totalCents,
          couponId,
          couponCode,
          notes: input.notes ?? null,
          items: {
            create: lines.map((l) => ({
              variantId: l.variantId,
              productId: l.productId,
              productName: l.productName,
              variantName: l.variantName,
              sku: l.sku,
              imageUrl: l.imageUrl,
              buyingPriceCents: l.buyingPriceCents,
              unitPriceCents: l.unitPriceCents,
              quantity: l.quantity,
            })),
          },
        },
      });

      // 5. Decrement stock per variant (grouped, fewer writes). Conditional
      // on stock still being sufficient — under concurrent checkouts for
      // the same variant, only one transaction's decrement can win; the
      // other sees `count !== 1` and fails cleanly instead of overselling.
      // Sorted by variantId so carts holding the same variants in different
      // order acquire row locks in a consistent order (no deadlocks).
      const sortedGroups = [...groupLinesByVariantId(lines)].sort(([a], [b]) => a.localeCompare(b));
      for (const [variantId, { quantity, productName }] of sortedGroups) {
        const res = await tx.productVariant.updateMany({
          where: { id: variantId, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (res.count !== 1) {
          throw stockConflict(variantId, productName, 'insufficient_stock');
        }
      }

      // 6. Increment coupon usage atomically. Re-read the limit inside this
      // transaction and only increment if still under it — closes the race
      // where concurrent checkouts could both pass validate()'s read-only
      // check and both increment past usageLimit.
      if (couponId) {
        const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: couponId } });
        const couponRes = await tx.coupon.updateMany({
          where: {
            id: couponId,
            ...(coupon.usageLimit !== null ? { usedCount: { lt: coupon.usageLimit } } : {}),
          },
          data: { usedCount: { increment: 1 } },
        });
        if (couponRes.count !== 1) {
          throw new ConflictError('This coupon has reached its usage limit');
        }
      }

      // 7. Create payment record.
      const isCod = input.paymentMethod === PaymentMethod.COD;
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          method: input.paymentMethod,
          status: PaymentStatus.PENDING,
          amountCents: totalCents,
        },
      });

      // 8. Audit (cart was consumed at the top of the transaction).
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status: OrderStatus.PENDING,
          note: 'Order placed',
          actorId: userId,
        },
      });

      // Auto-confirm COD orders so the admin sees them in CONFIRMED state.
      if (isCod) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.CONFIRMED },
        });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            status: OrderStatus.CONFIRMED,
            note: 'COD order auto-confirmed; awaiting fulfilment',
            actorId: userId,
          },
        });
      }

      const placed = await tx.order.findUnique({
        where: { id: order.id },
        include: { items: true, payments: true },
      });
      if (!placed) throw new Error('Order disappeared after creation');
      return { order: placed, paymentId: payment.id };
    });
  },

  /**
   * Undo a just-placed order when starting the payment (gateway
   * `kickoff`) failed — restores stock, releases the coupon slot, and
   * marks the order/payment cancelled so the customer isn't left with
   * a silent orphan. Called from the checkout route's catch branch.
   */
  async cancelOrphanedOrder(orderId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || order.status === OrderStatus.CANCELLED) return;

      // A concurrent canceller wins; we no-op.
      const claimed = await cancelOrderInTx(tx, order, {
        reason: 'Payment could not be started',
        event: { note: 'Payment could not be started; order cancelled automatically' },
      });
      if (!claimed) return;

      if (order.couponId) {
        await tx.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { decrement: 1 } },
        });
      }

      await tx.payment.updateMany({
        where: { orderId, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED },
      });
    });
  },
};
