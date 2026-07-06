import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/lib/prisma', () => {
  // $transaction invokes the callback with this same mock object as `tx`,
  // so service code works identically whether it runs inside or outside one.
  const prisma: Record<string, unknown> = {
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    location: {
      findUnique: vi.fn(),
    },
    orderRound: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    orderItem: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $executeRaw: vi.fn(),
  };
  prisma.$transaction = vi.fn(async (callback: (tx: unknown) => unknown) => callback(prisma));
  return { prisma };
});

vi.mock('../../../src/lib/business-day', () => ({
  startOfBusinessDay: vi.fn(() => new Date('2026-07-05T06:00:00.000Z')),
}));

import { prisma } from '../../../src/lib/prisma';
import { orderService, ORDER_ERRORS } from '../../../src/services/order.service';

// Typed view over the mocked prisma client for convenient assertions.
const prismaMock = prisma as unknown as {
  order: Record<string, ReturnType<typeof vi.fn>>;
  location: Record<string, ReturnType<typeof vi.fn>>;
  orderRound: Record<string, ReturnType<typeof vi.fn>>;
  orderItem: Record<string, ReturnType<typeof vi.fn>>;
};

describe('OrderService.createOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a takeout order with the next daily consecutive number', async () => {
    prismaMock.order.aggregate.mockResolvedValue({ _max: { takeoutNumber: 4 } });
    prismaMock.order.create.mockResolvedValue({ id: 1, takeoutNumber: 5 });

    const result = await orderService.createOrder({}, 2);

    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ takeoutNumber: 5, ownerUserId: 2 }) })
    );
    expect(result).toEqual({ id: 1, takeoutNumber: 5 });
  });

  it('starts the daily takeout counter at 1 when no orders exist yet today', async () => {
    prismaMock.order.aggregate.mockResolvedValue({ _max: { takeoutNumber: null } });
    prismaMock.order.create.mockResolvedValue({ id: 1, takeoutNumber: 1 });

    await orderService.createOrder({}, 2);

    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ takeoutNumber: 1 }) })
    );
  });

  it('throws LOCATION_NOT_FOUND when the location does not exist', async () => {
    prismaMock.location.findUnique.mockResolvedValue(null);

    await expect(orderService.createOrder({ locationId: 99 }, 2)).rejects.toThrow(
      ORDER_ERRORS.LOCATION_NOT_FOUND
    );
  });

  it('throws LOCATION_INACTIVE when the location is deactivated', async () => {
    prismaMock.location.findUnique.mockResolvedValue({ id: 1, type: 'table', active: false });

    await expect(orderService.createOrder({ locationId: 1 }, 2)).rejects.toThrow(
      ORDER_ERRORS.LOCATION_INACTIVE
    );
  });

  it('throws LOCATION_OCCUPIED when the table already has an open order', async () => {
    prismaMock.location.findUnique.mockResolvedValue({ id: 1, type: 'table', active: true });
    prismaMock.order.findFirst.mockResolvedValue({ id: 42 });

    await expect(orderService.createOrder({ locationId: 1 }, 2)).rejects.toThrow(
      ORDER_ERRORS.LOCATION_OCCUPIED
    );
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it('allows a bar location to open a new order even with existing open orders', async () => {
    prismaMock.location.findUnique.mockResolvedValue({ id: 8, type: 'bar', active: true });
    prismaMock.order.aggregate.mockResolvedValue({ _max: { barPosition: 2 } });
    prismaMock.order.create.mockResolvedValue({ id: 10, barPosition: 3 });

    const result = await orderService.createOrder({ locationId: 8 }, 2);

    expect(prismaMock.order.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ barPosition: 3, locationId: 8 }) })
    );
    expect(result).toEqual({ id: 10, barPosition: 3 });
  });
});

describe('OrderService.addRound', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('increments roundNumber based on existing rounds', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: 1, status: 'open' });
    prismaMock.orderRound.aggregate.mockResolvedValue({ _max: { roundNumber: 2 } });
    prismaMock.orderRound.create.mockResolvedValue({ id: 9, roundNumber: 3, items: [] });

    const result = await orderService.addRound(1, { items: [{ productId: 5, unitPrice: 10, quantity: 1 }] }, 2);

    expect(prismaMock.orderRound.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderId: 1, roundNumber: 3, userId: 2 }) })
    );
    expect(result).toEqual({ id: 9, roundNumber: 3, items: [] });
  });

  it('throws ORDER_NOT_FOUND when the order does not exist', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);

    await expect(orderService.addRound(1, { items: [] }, 2)).rejects.toThrow(ORDER_ERRORS.ORDER_NOT_FOUND);
  });

  it('throws ORDER_NOT_OPEN when the order is already charged or cancelled', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: 1, status: 'cancelled' });

    await expect(orderService.addRound(1, { items: [] }, 2)).rejects.toThrow(ORDER_ERRORS.ORDER_NOT_OPEN);
    expect(prismaMock.orderRound.create).not.toHaveBeenCalled();
  });
});

describe('OrderService item mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updateItem throws ROUND_NOT_FOUND when the round does not belong to the order', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ status: 'open' });
    prismaMock.orderRound.findFirst.mockResolvedValue(null);

    await expect(orderService.updateItem(1, 2, 3, { quantity: 2 })).rejects.toThrow(ORDER_ERRORS.ROUND_NOT_FOUND);
    expect(prismaMock.orderItem.update).not.toHaveBeenCalled();
  });

  it('deleteItem throws ITEM_NOT_FOUND when the item does not belong to the round', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ status: 'open' });
    prismaMock.orderRound.findFirst.mockResolvedValue({ id: 2 });
    prismaMock.orderItem.findFirst.mockResolvedValue(null);

    await expect(orderService.deleteItem(1, 2, 3)).rejects.toThrow(ORDER_ERRORS.ITEM_NOT_FOUND);
    expect(prismaMock.orderItem.delete).not.toHaveBeenCalled();
  });

  it('rejects mutations on a non-open order', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ status: 'charged' });

    await expect(orderService.updateItem(1, 2, 3, { quantity: 2 })).rejects.toThrow(ORDER_ERRORS.ORDER_NOT_OPEN);
  });
});

describe('OrderService.cancelOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancels an open order and stamps closedAt', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: 1, status: 'open' });
    prismaMock.order.update.mockResolvedValue({ id: 1, status: 'cancelled' });

    const result = await orderService.cancelOrder(1);

    expect(prismaMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: expect.objectContaining({ status: 'cancelled' }) })
    );
    expect(result).toEqual({ id: 1, status: 'cancelled' });
  });

  it('throws ORDER_NOT_OPEN when the order is already cancelled', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: 1, status: 'cancelled' });

    await expect(orderService.cancelOrder(1)).rejects.toThrow(ORDER_ERRORS.ORDER_NOT_OPEN);
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it('throws ORDER_NOT_FOUND when the order does not exist', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);

    await expect(orderService.cancelOrder(999)).rejects.toThrow(ORDER_ERRORS.ORDER_NOT_FOUND);
  });
});

describe('OrderService.computeOrderTotal', () => {
  it('sums round item subtotals and subtracts discount amounts', () => {
    const order = {
      rounds: [
        { items: [{ subtotal: 100 }, { subtotal: 50 }] },
        { items: [{ subtotal: 25 }] },
      ],
      discounts: [{ amount: 20 }],
    } as any;

    const result = orderService.computeOrderTotal(order);

    expect(result).toEqual({ subtotal: 175, discountTotal: 20, total: 155 });
  });
});
