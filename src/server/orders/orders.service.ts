import { Prisma, OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ConflictError, ForbiddenError, NotFoundError } from '@/server/common/errors';

const orderInclude = {
  items: true,
  payments: true,
  events: { orderBy: { createdAt: 'asc' as const } },
  address: true,
} satisfies Prisma.OrderInclude;

export type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

/**
 * Restore stock for an order's line items. Shared by admin cancel,
 * payment-failure callbacks, and orphaned-checkout cleanup — every
 * place that undoes a `placeOrder` stock decrement.
 */
export async function restockOrderItems(
  tx: Prisma.TransactionClient,
  items: { variantId: string | null; quantity: number }[],
) {
  for (const item of items) {
    if (item.variantId) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }
}

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

export const ordersService = {
  listByUser(userId: string) {
    return prisma.order.findMany({
      where: { userId },
      include: { items: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  listAll() {
    return prisma.order.findMany({
      include: {
        items: true,
        payments: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getOwned(userId: string, id: string) {
    const order = await prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundError('Order');
    if (order.userId !== userId) throw new ForbiddenError('Not your order');
    return order;
  },

  async getAdmin(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { ...orderInclude, user: true },
    });
    if (!order) throw new NotFoundError('Order');
    return order;
  },

  /**
   * Customer-initiated cancellation. Allowed only while the order is
   * still in PENDING / CONFIRMED / PROCESSING. Once it has shipped the
   * customer must contact support; once delivered the path is the
   * warranty flow. Stock is restocked atomically on cancellation.
   */
  async cancelByCustomer(userId: string, orderId: string, reason: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new NotFoundError('Order');
      if (order.userId !== userId) throw new ForbiddenError('Not your order');
      if (order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED) {
        throw new ConflictError('Order has already shipped');
      }
      if (order.status === OrderStatus.CANCELLED) {
        throw new ConflictError('Order is already cancelled');
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      });

      await restockOrderItems(tx, order.items);

      await tx.orderEvent.create({
        data: {
          orderId,
          status: OrderStatus.CANCELLED,
          note: `Cancelled by customer: ${reason}`,
          actorId: userId,
        },
      });

      return tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
    });
  },

  /**
   * Admin transition with optional note. Rejects any move not in
   * ALLOWED_TRANSITIONS (e.g. DELIVERED -> PENDING, re-cancelling an
   * already-cancelled order). Cancelling restocks the order's items,
   * matching customer self-cancel behavior.
   */
  async transition(adminId: string, orderId: string, status: OrderStatus, note?: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new NotFoundError('Order');
      if (!ALLOWED_TRANSITIONS[order.status].includes(status)) {
        throw new ConflictError(`Cannot move order from ${order.status} to ${status}`);
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status,
          cancelledAt: status === OrderStatus.CANCELLED ? new Date() : order.cancelledAt,
          cancelReason: status === OrderStatus.CANCELLED ? (note ?? 'Admin') : order.cancelReason,
        },
      });

      if (status === OrderStatus.CANCELLED) {
        await restockOrderItems(tx, order.items);
      }

      await tx.orderEvent.create({
        data: { orderId, status, note: note ?? null, actorId: adminId },
      });
      return updated;
    });
  },
};
