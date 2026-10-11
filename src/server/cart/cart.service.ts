import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type { CartLine, CartSnapshot, GuestCartLine } from '@/contracts/cart';
import { applyDiscount } from '@/server/common/money';
import { NotFoundError, ValidationError } from '@/server/common/errors';

type FlatCartRow = {
  itemId: string;
  variantId: string;
  quantity: number;
  productName: string;
  productSlug: string;
  imageUrl: string | null;
  variantName: string | null;
  sku: string;
  stock: number;
  isActive: boolean;
  sellingPriceCents: number;
  discountCents: number;
};

function snapshotFromRows(rows: FlatCartRow[]): CartSnapshot {
  const lines: CartLine[] = rows.map((row) => ({
    itemId: row.itemId,
    variantId: row.variantId,
    // Keep productId omitted to avoid extra payload and joins not needed by cart UI.
    productId: '',
    productSlug: row.productSlug,
    productName: row.productName,
    variantName: row.variantName,
    sku: row.sku,
    imageUrl: row.imageUrl,
    unitPriceCents: applyDiscount(row.sellingPriceCents, row.discountCents),
    originalUnitPriceCents: row.sellingPriceCents,
    quantity: row.quantity,
    stock: row.stock,
    isActive: row.isActive,
  }));
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  return { lines, subtotalCents, itemCount };
}

async function ensureCart(userId: string) {
  return prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

async function loadCart(userId: string): Promise<CartSnapshot> {
  const cart = await ensureCart(userId);
  const rows = await prisma.$queryRaw<FlatCartRow[]>(Prisma.sql`
    SELECT
      ci.id AS "itemId",
      ci."variantId" AS "variantId",
      ci.quantity AS "quantity",
      p.name AS "productName",
      p.slug AS "productSlug",
      COALESCE(
        (
          SELECT i.url
          FROM "ProductImage" i
          WHERE i."productId" = p.id
          ORDER BY i."sortOrder" ASC
          LIMIT 1
        ),
        NULL
      ) AS "imageUrl",
      pv.name AS "variantName",
      pv.sku AS "sku",
      pv.stock AS "stock",
      (pv."isActive" AND p.status = 'PUBLISHED') AS "isActive",
      pv."sellingPriceCents" AS "sellingPriceCents",
      pv."discountCents" AS "discountCents"
    FROM "CartItem" ci
    INNER JOIN "ProductVariant" pv ON pv.id = ci."variantId"
    INNER JOIN "Product" p ON p.id = pv."productId"
    WHERE ci."cartId" = ${cart.id}
    ORDER BY ci."variantId" ASC
  `);
  return snapshotFromRows(rows);
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
  async getCartSummary(userId: string): Promise<{
    subtotalCents: number;
    itemCount: number;
    hasIssues: boolean;
  }> {
    await ensureCart(userId);
    const lines = await prisma.cartItem.findMany({
      where: { cart: { userId } },
      select: {
        quantity: true,
        variant: {
          select: {
            stock: true,
            isActive: true,
            sellingPriceCents: true,
            discountCents: true,
            product: { select: { status: true } },
          },
        },
      },
    });
    let subtotalCents = 0;
    let itemCount = 0;
    let hasIssues = false;
    for (const line of lines) {
      const unitPrice = applyDiscount(line.variant.sellingPriceCents, line.variant.discountCents);
      subtotalCents += unitPrice * line.quantity;
      itemCount += line.quantity;
      if (
        !line.variant.isActive ||
        line.variant.product.status !== 'PUBLISHED' ||
        line.quantity > line.variant.stock
      ) {
        hasIssues = true;
      }
    }
    return { subtotalCents, itemCount, hasIssues };
  },

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
    const aggregatedGuestQty = new Map<string, number>();
    for (const line of guestLines) {
      aggregatedGuestQty.set(line.variantId, (aggregatedGuestQty.get(line.variantId) ?? 0) + line.quantity);
    }
    const variantIds = [...aggregatedGuestQty.keys()];
    const [variants, existingItems] = await Promise.all([
      prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          stock: true,
          isActive: true,
          product: { select: { status: true } },
        },
      }),
      prisma.cartItem.findMany({
        where: { cartId: cart.id, variantId: { in: variantIds } },
        select: { id: true, variantId: true, quantity: true },
      }),
    ]);

    const validVariantById = new Map(
      variants
        .filter((v) => v.isActive && v.product.status === 'PUBLISHED')
        .map((v) => [v.id, v] as const),
    );
    const existingItemByVariantId = new Map(existingItems.map((i) => [i.variantId, i] as const));
    const createRows: Array<{ cartId: string; variantId: string; quantity: number }> = [];
    const updateOps: Array<ReturnType<typeof prisma.cartItem.update>> = [];

    for (const [variantId, guestQty] of aggregatedGuestQty.entries()) {
      const variant = validVariantById.get(variantId);
      if (!variant) continue;
      const existing = existingItemByVariantId.get(variantId);
      const desired = (existing?.quantity ?? 0) + guestQty;
      const clamped = Math.min(desired, variant.stock);
      if (clamped <= 0) continue;

      if (existing) {
        if (existing.quantity !== clamped) {
          updateOps.push(prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: clamped } }));
        }
      } else {
        createRows.push({ cartId: cart.id, variantId, quantity: clamped });
      }
    }

    await prisma.$transaction([
      ...(createRows.length > 0
        ? [
            prisma.cartItem.createMany({
              data: createRows,
              skipDuplicates: true,
            }),
          ]
        : []),
      ...updateOps,
    ]);

    return loadCart(userId);
  },
};
