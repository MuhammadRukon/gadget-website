import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type { CartLine, CartSnapshot, GuestCartLine } from '@/contracts/cart';
import { applyDiscount } from '@/server/common/money';
import { NotFoundError, ValidationError } from '@/server/common/errors';

const cartItemInclude = {
  variant: {
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
        },
      },
    },
  },
} satisfies Prisma.CartItemInclude;

type CartItemWithVariant = Prisma.CartItemGetPayload<{ include: typeof cartItemInclude }>;

function toLine(item: CartItemWithVariant): CartLine {
  const v = item.variant;
  const p = v.product;
  return {
    itemId: item.id,
    variantId: v.id,
    productId: p.id,
    productSlug: p.slug,
    productName: p.name,
    variantName: v.name,
    sku: v.sku,
    imageUrl: p.images[0]?.url ?? null,
    unitPriceCents: applyDiscount(v.sellingPriceCents, v.discountCents),
    originalUnitPriceCents: v.sellingPriceCents,
    quantity: item.quantity,
    stock: v.stock,
    isActive: v.isActive && p.status === 'PUBLISHED',
  };
}

function snapshot(items: CartItemWithVariant[]): CartSnapshot {
  const lines = items.map(toLine);
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  return { lines, subtotalCents, itemCount };
}

async function ensureCart(userId: string) {
  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.cart.create({ data: { userId } });
}

async function loadCart(userId: string): Promise<CartSnapshot> {
  await ensureCart(userId);
  const items = await prisma.cartItem.findMany({
    where: { cart: { userId } },
    include: cartItemInclude,
    orderBy: { variantId: 'asc' },
  });
  return snapshot(items);
}

async function assertVariantPurchasable(variantId: string, quantity: number) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { select: { status: true } } },
  });
  if (!variant || !variant.isActive || variant.product.status !== 'PUBLISHED') {
    throw new NotFoundError('Variant');
  }
  if (variant.stock < quantity) {
    throw new ValidationError('Not enough stock for this variant', {
      stock: variant.stock,
      requested: quantity,
    });
  }
  return variant;
}

export const cartService = {
  getCart(userId: string): Promise<CartSnapshot> {
    return loadCart(userId);
  },

  async addItem(userId: string, input: { variantId: string; quantity: number }): Promise<CartSnapshot> {
    const cart = await ensureCart(userId);

    const existing = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId: input.variantId } },
    });
    const nextQty = (existing?.quantity ?? 0) + input.quantity;
    await assertVariantPurchasable(input.variantId, nextQty);

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: nextQty },
      });
    } else {
      await prisma.cartItem.create({
        data: { cartId: cart.id, variantId: input.variantId, quantity: input.quantity },
      });
    }
    return loadCart(userId);
  },

  async updateItem(
    userId: string,
    itemId: string,
    quantity: number,
  ): Promise<CartSnapshot> {
    if (quantity <= 0) return this.removeItem(userId, itemId);
    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });
    if (!item || item.cart.userId !== userId) throw new NotFoundError('Cart item');
    await assertVariantPurchasable(item.variantId, quantity);
    await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return loadCart(userId);
  },

  async removeItem(userId: string, itemId: string): Promise<CartSnapshot> {
    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });
    if (!item || item.cart.userId !== userId) throw new NotFoundError('Cart item');
    await prisma.cartItem.delete({ where: { id: itemId } });
    return loadCart(userId);
  },

  async clear(userId: string): Promise<void> {
    await prisma.cartItem.deleteMany({ where: { cart: { userId } } });
  },

  /**
   * Build a snapshot from raw guest-cart lines without touching the
   * database for cart records. Used by the unauthenticated cart UI so
   * it can render rich rows (price, image, name) using the same
   * `CartLine` shape as the server cart.
   */
  async hydrateGuestCart(guestLines: GuestCartLine[]): Promise<CartSnapshot> {
    if (guestLines.length === 0) return { lines: [], subtotalCents: 0, itemCount: 0 };
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: guestLines.map((l) => l.variantId) } },
      include: {
        product: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
          },
        },
      },
    });
    const byVariantId = new Map(variants.map((v) => [v.id, v]));
    const lines: CartLine[] = [];
    for (const guest of guestLines) {
      const v = byVariantId.get(guest.variantId);
      if (!v) continue;
      const p = v.product;
      lines.push({
        itemId: guest.variantId,
        variantId: v.id,
        productId: p.id,
        productSlug: p.slug,
        productName: p.name,
        variantName: v.name,
        sku: v.sku,
        imageUrl: p.images[0]?.url ?? null,
        unitPriceCents: applyDiscount(v.sellingPriceCents, v.discountCents),
        originalUnitPriceCents: v.sellingPriceCents,
        quantity: guest.quantity,
        stock: v.stock,
        isActive: v.isActive && p.status === 'PUBLISHED',
      });
    }
    const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
    const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
    return { lines, subtotalCents, itemCount };
  },

  /**
   * Merge a guest cart (typically held in localStorage) into the
   * authenticated user's server cart on login. Quantities are summed
   * and clamped to available stock; unavailable variants are silently
   * skipped so the merge never fails the login flow.
   */
  async mergeGuestCart(userId: string, guestLines: GuestCartLine[]): Promise<CartSnapshot> {
    if (guestLines.length === 0) return loadCart(userId);
    const cart = await ensureCart(userId);

    for (const line of guestLines) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: line.variantId },
        include: { product: { select: { status: true } } },
      });
      if (!variant || !variant.isActive || variant.product.status !== 'PUBLISHED') continue;

      const existing = await prisma.cartItem.findUnique({
        where: { cartId_variantId: { cartId: cart.id, variantId: line.variantId } },
      });
      const desired = (existing?.quantity ?? 0) + line.quantity;
      const clamped = Math.min(desired, variant.stock);
      if (clamped <= 0) continue;

      if (existing) {
        await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: clamped } });
      } else {
        await prisma.cartItem.create({
          data: { cartId: cart.id, variantId: line.variantId, quantity: clamped },
        });
      }
    }

    return loadCart(userId);
  },
};
