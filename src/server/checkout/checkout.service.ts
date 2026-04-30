import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { randomBytes } from 'crypto';

import { prisma } from '@/lib/prisma';
import type { CheckoutInput, CheckoutQuote } from '@/contracts/checkout';
import { applyDiscount } from '@/server/common/money';
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from '@/server/common/errors';
import { couponsService } from '@/server/coupons/coupons.service';

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

function groupQtyByVariantId(lines: Pick<ResolvedCartLine, 'variantId' | 'quantity'>[]) {
  const byVariantId = new Map<string, number>();
  for (const line of lines) {
    byVariantId.set(line.variantId, (byVariantId.get(line.variantId) ?? 0) + line.quantity);
  }
  return byVariantId;
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
    if (!v.isActive || p.status !== 'PUBLISHED') {
      throw new ValidationError(`"${p.name}" is no longer available`, { variantId: v.id });
    }
    if (v.stock < item.quantity) {
      throw new ValidationError(`Not enough stock for "${p.name}"`, {
        variantId: v.id,
        stock: v.stock,
        requested: item.quantity,
      });
    }
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
   *   1. Re-validate the cart against current stock to avoid overselling
   *      between quote and confirm.
   *   2. Snapshot every line into `OrderItem` (price, name, sku, image,
   *      buying price) so future catalog changes never alter past orders.
   *   3. Decrement variant stock.
   *   4. Bump coupon `usedCount` if applied.
   *   5. Create the `Payment` row in PENDING (or SUCCEEDED for COD,
   *      since cash on delivery is collected on receipt; treating it
   *      as immediately succeeded keeps order dashboards consistent).
   *   6. Clear the cart.
   *   7. Append an `OrderEvent` for audit.
   * Anything failing rolls the whole thing back atomically.
   */
  async placeOrder(userId: string, input: CheckoutInput) {
    const address = await loadAddressOrThrow(userId, input.addressId);

    return prisma.$transaction(async (tx) => {
      // 1. Re-validate cart inside the transaction.
      const cartItems = await tx.cartItem.findMany({
        where: { cart: { userId } },
        include: {
          variant: { include: { product: { select: { id: true, name: true, status: true, images: { orderBy: { sortOrder: 'asc' as const }, take: 1 } } } } },
        },
      });
      if (cartItems.length === 0) {
        throw new BadRequestError('Cart is empty');
      }
      for (const item of cartItems) {
        if (!item.variant.isActive || item.variant.product.status !== 'PUBLISHED') {
          throw new ValidationError(`"${item.variant.product.name}" is no longer available`);
        }
        if (item.variant.stock < item.quantity) {
          throw new ValidationError(`Not enough stock for "${item.variant.product.name}"`);
        }
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

      // 2. Validate coupon (we re-run inside tx to lock in usedCount).
      let discountCents = 0;
      let couponId: string | null = null;
      let couponCode: string | null = null;
      if (input.couponCode) {
        const validated = await couponsService.validate({
          code: input.couponCode,
          userId,
          subtotalCents,
        });
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

      // 3. Re-check grouped stock totals to avoid oversell when the same
      // variant appears multiple times (defensive) and to support grouped
      // decrement updates below.
      const qtyByVariantId = groupQtyByVariantId(lines);
      for (const [variantId, requiredQty] of qtyByVariantId.entries()) {
        const variant = cartItems.find((item) => item.variant.id === variantId)?.variant;
        if (!variant || variant.stock < requiredQty) {
          throw new ValidationError('Not enough stock to complete checkout', { variantId });
        }
      }

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

      // 5. Decrement stock per variant (grouped, fewer writes).
      for (const [variantId, quantity] of qtyByVariantId.entries()) {
        await tx.productVariant.update({
          where: { id: variantId },
          data: { stock: { decrement: quantity } },
        });
      }

      // 6. Increment coupon usage atomically.
      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } },
        });
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

      // 8. Clear cart and audit.
      await tx.cartItem.deleteMany({ where: { cart: { userId } } });
      await tx.orderEvent.create({
        data: { orderId: order.id, status: OrderStatus.PENDING, note: 'Order placed', actorId: userId },
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
};
