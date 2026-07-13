import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { startOfBusinessDay } from '../lib/business-day';
import type { AddRoundDTO, CreateOrderDTO, UpdateOrderItemDTO } from '../types/order.types';

// Domain error messages, matched by the controller to pick an HTTP status.
export const ORDER_ERRORS = {
  LOCATION_NOT_FOUND: 'Location not found',
  LOCATION_INACTIVE: 'Location is not active',
  LOCATION_OCCUPIED: 'Location already has an open order',
  ORDER_NOT_FOUND: 'Order not found',
  ORDER_NOT_OPEN: 'Order is not open',
  ROUND_NOT_FOUND: 'Round not found for this order',
  ITEM_NOT_FOUND: 'Item not found in this round',
} as const;

// Advisory lock keys used to serialize daily-counter assignment across
// concurrent order creations. Arbitrary but stable constants.
const ADVISORY_LOCK = {
  BAR_POSITION: 411001,
  TAKEOUT_NUMBER: 411002,
} as const;

type OrderRoundWithItems = Prisma.OrderRoundGetPayload<{ include: { items: true } }>;

function sumItems(items: { subtotal: Prisma.Decimal }[]): number {
  return items.reduce((sum, item) => sum + Number(item.subtotal), 0);
}

function computeRoundTotal(round: OrderRoundWithItems): number {
  return sumItems(round.items);
}

export class OrderService {
  async listOrders(filter: { mine?: boolean; userId?: number }) {
    return prisma.order.findMany({
      where: {
        status: 'open',
        ...(filter.mine && filter.userId ? { ownerUserId: filter.userId } : {}),
      },
      include: {
        location: true,
        owner: { select: { id: true, displayName: true } },
        rounds: { include: { items: { orderBy: { id: 'asc' } } } },
        discounts: true,
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async getOrderById(id: number) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        location: true,
        owner: { select: { id: true, displayName: true } },
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: {
            items: { orderBy: { id: 'asc' }, include: { product: true } },
            user: { select: { id: true, displayName: true } },
          },
        },
        discounts: true,
      },
    });
  }

  async createOrder(data: CreateOrderDTO, ownerUserId: number) {
    if (data.locationId == null) {
      return prisma.$transaction(async (tx) => {
        const takeoutNumber = await this.nextDailyCounter(tx, 'takeoutNumber', ADVISORY_LOCK.TAKEOUT_NUMBER);
        return tx.order.create({
          data: { takeoutNumber, ownerUserId, notes: data.notes },
          include: { location: true, owner: { select: { id: true, displayName: true } } },
        });
      });
    }

    return prisma.$transaction(async (tx) => {
      const location = await tx.location.findUnique({ where: { id: data.locationId } });
      if (!location) throw new Error(ORDER_ERRORS.LOCATION_NOT_FOUND);
      if (!location.active) throw new Error(ORDER_ERRORS.LOCATION_INACTIVE);

      if (location.type === 'table') {
        const existingOpen = await tx.order.findFirst({
          where: { locationId: location.id, status: 'open' },
          select: { id: true },
        });
        if (existingOpen) throw new Error(ORDER_ERRORS.LOCATION_OCCUPIED);

        return tx.order.create({
          data: { locationId: location.id, ownerUserId, notes: data.notes },
          include: { location: true, owner: { select: { id: true, displayName: true } } },
        });
      }

      const barPosition = await this.nextDailyCounter(tx, 'barPosition', ADVISORY_LOCK.BAR_POSITION);
      return tx.order.create({
        data: { locationId: location.id, barPosition, ownerUserId, notes: data.notes },
        include: { location: true, owner: { select: { id: true, displayName: true } } },
      });
    });
  }

  private async nextDailyCounter(
    tx: Prisma.TransactionClient,
    field: 'barPosition' | 'takeoutNumber',
    lockKey: number
  ): Promise<number> {
    // Serialize concurrent counter assignment for the day; released
    // automatically at transaction end (pg_advisory_xact_lock).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

    const max = await tx.order.aggregate({
      where: { openedAt: { gte: startOfBusinessDay() } },
      _max: { [field]: true },
    });

    const current = (max._max as Record<string, number | null>)[field];
    return (current ?? 0) + 1;
  }

  async addRound(orderId: number, data: AddRoundDTO, userId: number) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error(ORDER_ERRORS.ORDER_NOT_FOUND);
      if (order.status !== 'open') throw new Error(ORDER_ERRORS.ORDER_NOT_OPEN);

      const maxRound = await tx.orderRound.aggregate({
        where: { orderId },
        _max: { roundNumber: true },
      });
      const roundNumber = (maxRound._max.roundNumber ?? 0) + 1;

      const round = await tx.orderRound.create({
        data: {
          orderId,
          roundNumber,
          userId,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              customName: item.customName,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              notes: item.notes,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      return round;
    });
  }

  async updateItem(orderId: number, roundId: number, itemId: number, data: UpdateOrderItemDTO) {
    await this.assertOpenOrderRoundItem(orderId, roundId, itemId);

    return prisma.orderItem.update({
      where: { id: itemId },
      data: {
        unitPrice: data.unitPrice,
        quantity: data.quantity,
        notes: data.notes,
      },
      include: { product: true },
    });
  }

  async deleteItem(orderId: number, roundId: number, itemId: number) {
    await this.assertOpenOrderRoundItem(orderId, roundId, itemId);

    await prisma.$transaction(async (tx) => {
      const itemCount = await tx.orderItem.count({ where: { roundId } });
      if (itemCount === 1) {
        // Deleting the round's only item would leave it empty — remove the round too (cascades to the item).
        await tx.orderRound.delete({ where: { id: roundId } });
        return;
      }
      await tx.orderItem.delete({ where: { id: itemId } });
    });
  }

  async deleteRound(orderId: number, roundId: number) {
    await this.assertOpenOrderRound(orderId, roundId);
    // Cascades to the round's items (OrderItem.round has onDelete: Cascade).
    await prisma.orderRound.delete({ where: { id: roundId } });
  }

  private async assertOpenOrderRound(orderId: number, roundId: number): Promise<void> {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!order) throw new Error(ORDER_ERRORS.ORDER_NOT_FOUND);
    if (order.status !== 'open') throw new Error(ORDER_ERRORS.ORDER_NOT_OPEN);

    const round = await prisma.orderRound.findFirst({ where: { id: roundId, orderId }, select: { id: true } });
    if (!round) throw new Error(ORDER_ERRORS.ROUND_NOT_FOUND);
  }

  private async assertOpenOrderRoundItem(orderId: number, roundId: number, itemId: number): Promise<void> {
    await this.assertOpenOrderRound(orderId, roundId);

    const item = await prisma.orderItem.findFirst({ where: { id: itemId, roundId }, select: { id: true } });
    if (!item) throw new Error(ORDER_ERRORS.ITEM_NOT_FOUND);
  }

  async cancelOrder(id: number) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id } });
      if (!order) throw new Error(ORDER_ERRORS.ORDER_NOT_FOUND);
      if (order.status !== 'open') throw new Error(ORDER_ERRORS.ORDER_NOT_OPEN);

      return tx.order.update({
        where: { id },
        data: { status: 'cancelled', closedAt: new Date() },
      });
    });
  }

  computeOrderTotal(order: { rounds: OrderRoundWithItems[]; discounts: { amount: Prisma.Decimal }[] }): {
    subtotal: number;
    discountTotal: number;
    total: number;
  } {
    const subtotal = order.rounds.reduce((sum, round) => sum + computeRoundTotal(round), 0);
    const discountTotal = order.discounts.reduce((sum, discount) => sum + Number(discount.amount), 0);
    return { subtotal, discountTotal, total: subtotal - discountTotal };
  }
}

export const orderService = new OrderService();
