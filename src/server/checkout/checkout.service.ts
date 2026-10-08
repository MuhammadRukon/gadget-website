import { CodFeeStatus, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { randomBytes } from 'crypto';

import { prisma } from '@/lib/prisma';
import type { CheckoutInput, CheckoutQuote, StockConflictMeta } from '@/contracts/checkout';
import { normalizeTxnId } from '@/contracts/payments';
import { BadRequestError, ConflictError, NotFoundError } from '@/server/common/errors';
import { cancelOrderInTx } from '@/server/orders/orders.service';
import { assertTxnIdFree, mapTxnIdViolation } from '@/server/payments/txn-id';
import {
  assertMethodAvailable,
  paymentSettingsService,
} from '@/server/settings/payment-settings.service';

import { loadCart, type ResolvedCartLine } from './cart-lines';
import { priceOrder } from './pricing';

interface QuoteInput {
  userId: string;
  addressId: string;
  couponCode?: string;
  paymentMethod?: PaymentMethod;
}

function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = randomBytes(3).toString('hex').toUpperCase();
  return `T-${ts}-${rnd}`;
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
  const { items, lines } = await loadCart(prisma, userId);
  for (const item of items) assertLineAvailable(item);
  return lines;
}

export const checkoutService = {
  async quote(input: QuoteInput): Promise<CheckoutQuote> {
    const { userId, addressId, couponCode, paymentMethod } = input;
    // Independent reads run concurrently. Settings are only needed (and only
    // read) when the caller asks about a payment method.
    const [address, lines, settings] = await Promise.all([
      loadAddressOrThrow(userId, addressId),
      loadCartLines(userId),
      paymentMethod ? paymentSettingsService.get() : undefined,
    ]);
    const payment = paymentMethod && settings ? { method: paymentMethod, settings } : undefined;

    const priced = await priceOrder(prisma, { userId, address, lines, couponCode, payment });
    if (payment) assertMethodAvailable(payment.settings, payment.method);

    const codFeeCents = priced.codFee?.feeCents ?? 0;
    return {
      subtotalCents: priced.subtotalCents,
      discountCents: priced.discountCents,
      shippingCents: priced.shippingCents,
      totalCents: priced.totalCents,
      couponCode: priced.couponCode,
      codFeeCents,
      dueOnDeliveryCents: priced.totalCents - codFeeCents,
      codFeeRule: priced.codFee?.rule ?? null,
    };
  },

  /**
   * Place an order. Single Prisma transaction does:
   *   1. Consume the cart first (count-checked delete) to serialize
   *      duplicate submits for the same user. Right after that, and before
   *      any stock mutation, the chosen payment method is checked against
   *      the admin's effective settings (a throw rolls back the consume).
   *   2. Re-validate every line against current availability/stock to
   *      avoid overselling between quote and confirm.
   *   3. Re-validate the coupon and compute totals + shipping.
   *   4. Create the `Order`, snapshotting every line into `OrderItem`
   *      (price, name, sku, image, buying price) so future catalog
   *      changes never alter past orders. The COD confirmation fee (if
   *      any) is resolved and snapshotted on the `Payment`.
   *   5. Decrement variant stock atomically (in sorted variantId order);
   *      the conditional update is the real oversell guard.
   *   6. Bump coupon `usedCount` if applied.
   *   7. Create the `Payment` row in PENDING. COD is auto-confirmed at the
   *      order level unless a confirmation fee applies, in which case the
   *      order stays PENDING until an admin verifies the fee; the payment
   *      itself stays PENDING until cash is collected.
   *   8. Append an `OrderEvent` for audit.
   * Anything failing rolls the whole thing back atomically.
   */
  async placeOrder(userId: string, input: CheckoutInput) {
    const address = await loadAddressOrThrow(userId, input.addressId);

    return prisma.$transaction(async (tx) => {
      // 1. Read and consume the cart inside the transaction.
      const { items: cartItems, lines } = await loadCart(tx, userId);
      // Consume the cart first. A concurrent placeOrder for the same user
      // blocks on these row deletes (READ COMMITTED row locks) and then
      // finds 0 rows, so a double submit can only succeed once.
      const consumed = await tx.cartItem.deleteMany({
        where: { id: { in: lines.map((l) => l.cartItemId) } },
      });
      if (consumed.count !== lines.length) {
        throw new ConflictError('Your cart changed, please review and try again');
      }

      // Enforce the admin's payment-method settings with a single settings
      // read via tx (`effectiveMethods` also drops gateways without
      // credentials). Before any stock mutation: a throw rolls back,
      // including the cart consume above.
      const settings = await paymentSettingsService.get(tx);
      assertMethodAvailable(settings, input.paymentMethod);

      // 2. Re-validate availability and per-line stock.
      for (const item of cartItems) {
        assertLineAvailable(item);
      }

      // 3. Price the order; the coupon is re-validated inside the tx to lock in usedCount.
      const {
        subtotalCents,
        discountCents,
        couponId,
        couponCode,
        shippingCents,
        totalCents,
        codFee,
      } = await priceOrder(tx, {
        userId,
        address,
        lines,
        couponCode: input.couponCode,
        payment: { method: input.paymentMethod, settings },
      });

      // The txn id only means something when a fee is being paid; ignore it otherwise.
      const customerTxnId =
        codFee && input.customerTxnId ? normalizeTxnId(input.customerTxnId) : null;
      if (customerTxnId) await assertTxnIdFree(tx, customerTxnId);

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
          // Placement-time snapshot only. Payment.feeCents / feeStatus are
          // authoritative: a waived or rejected fee never rewrites this value.
          codFeeCents: codFee?.feeCents ?? 0,
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
      let payment;
      try {
        payment = await tx.payment.create({
          data: {
            orderId: order.id,
            method: input.paymentMethod,
            status: PaymentStatus.PENDING,
            amountCents: totalCents,
            ...(codFee
              ? {
                  feeCents: codFee.feeCents,
                  feeType: codFee.rule.type,
                  feeValue: codFee.rule.value,
                  feeStatus: CodFeeStatus.PENDING,
                  ...(customerTxnId ? { customerTxnId, txnSubmittedAt: new Date() } : {}),
                }
              : {}),
          },
        });
      } catch (err) {
        // Lost a race on the unique index despite the pre-check above.
        throw customerTxnId ? await mapTxnIdViolation(err, customerTxnId) : err;
      }

      // 8. Audit (cart was consumed at the top of the transaction).
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status: OrderStatus.PENDING,
          note: 'Order placed',
          actorId: userId,
        },
      });

      if (codFee) {
        // Stays PENDING until an admin verifies the fee (codFeeService.verifyFee).
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            status: OrderStatus.PENDING,
            note: 'COD confirmation fee pending',
            actorId: userId,
          },
        });
      } else if (input.paymentMethod === PaymentMethod.COD) {
        // No fee: auto-confirm COD orders so the admin sees them in CONFIRMED state.
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
      return { order: placed, paymentId: payment.id, feeRequired: codFee !== null };
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
