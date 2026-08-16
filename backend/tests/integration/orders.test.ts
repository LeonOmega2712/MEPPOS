import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { orderService, ORDER_ERRORS } from '../../src/services/order.service';
import { generateAccessToken } from '../../src/lib/jwt';

vi.mock('../../src/services/order.service', async () => {
  const actual = await vi.importActual<typeof import('../../src/services/order.service')>(
    '../../src/services/order.service'
  );
  return {
    ORDER_ERRORS: actual.ORDER_ERRORS,
    orderService: {
      listOrders: vi.fn(),
      getOrderById: vi.fn(),
      createOrder: vi.fn(),
      addRound: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      deleteRound: vi.fn(),
      cancelOrder: vi.fn(),
      chargeOrder: vi.fn(),
      computeOrderTotal: actual.orderService.computeOrderTotal.bind(actual.orderService),
    },
  };
});

const adminToken = generateAccessToken({ userId: 1, username: 'admin', role: 'ADMIN' });
const waiterToken = generateAccessToken({ userId: 2, username: 'waiter', role: 'WAITER' });

const mockOrder = {
  id: 1,
  locationId: 1,
  barPosition: null,
  takeoutNumber: null,
  status: 'open',
  ownerUserId: 2,
  openedAt: new Date().toISOString(),
  closedAt: null,
  notes: null,
  location: { id: 1, name: 'Mesa 1', type: 'table' },
  owner: { id: 2, displayName: 'Waiter' },
  rounds: [],
  discounts: [],
};

// ─── GET /orders ──────────────────────────────────────────────────────────────

describe('GET /api/orders', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 200 with open orders', async () => {
    vi.mocked(orderService.listOrders).mockResolvedValue([mockOrder] as any);

    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ id: 1, total: 0 });
    expect(orderService.listOrders).toHaveBeenCalledWith({ mine: false, userId: 2 });
  });

  it('passes mine=true through to the service with the authenticated user id', async () => {
    vi.mocked(orderService.listOrders).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/orders?mine=true')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(orderService.listOrders).toHaveBeenCalledWith({ mine: true, userId: 2 });
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/orders');

    expect(res.status).toBe(401);
    expect(orderService.listOrders).not.toHaveBeenCalled();
  });
});

// ─── GET /orders/:id ──────────────────────────────────────────────────────────

describe('GET /api/orders/:id', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns order detail with computed totals', async () => {
    vi.mocked(orderService.getOrderById).mockResolvedValue(mockOrder as any);

    const res = await request(app).get('/api/orders/1').set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 1, subtotal: 0, discountTotal: 0, total: 0 });
  });

  it('returns 404 when order does not exist', async () => {
    vi.mocked(orderService.getOrderById).mockResolvedValue(null);

    const res = await request(app).get('/api/orders/999').set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(ORDER_ERRORS.ORDER_NOT_FOUND);
  });

  it('returns 400 for a non-numeric id', async () => {
    const res = await request(app).get('/api/orders/abc').set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(400);
    expect(orderService.getOrderById).not.toHaveBeenCalled();
  });
});

// ─── POST /orders ─────────────────────────────────────────────────────────────

describe('POST /api/orders', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('opens a dine-in order (any authenticated role)', async () => {
    vi.mocked(orderService.createOrder).mockResolvedValue(mockOrder as any);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ locationId: 1 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(orderService.createOrder).toHaveBeenCalledWith({ locationId: 1 }, 2);
  });

  it('opens a takeout order without a locationId', async () => {
    vi.mocked(orderService.createOrder).mockResolvedValue({ ...mockOrder, locationId: null, takeoutNumber: 1 } as any);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(orderService.createOrder).toHaveBeenCalledWith({}, 2);
  });

  it('returns 400 on invalid locationId', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ locationId: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(orderService.createOrder).not.toHaveBeenCalled();
  });

  it('returns 404 when the service reports the location does not exist', async () => {
    vi.mocked(orderService.createOrder).mockRejectedValue(new Error(ORDER_ERRORS.LOCATION_NOT_FOUND));

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ locationId: 999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(ORDER_ERRORS.LOCATION_NOT_FOUND);
  });

  it('returns 409 when the location already has an open order', async () => {
    vi.mocked(orderService.createOrder).mockRejectedValue(new Error(ORDER_ERRORS.LOCATION_OCCUPIED));

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ locationId: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(ORDER_ERRORS.LOCATION_OCCUPIED);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/orders').send({});

    expect(res.status).toBe(401);
    expect(orderService.createOrder).not.toHaveBeenCalled();
  });
});

// ─── POST /orders/:id/rounds ──────────────────────────────────────────────────

describe('POST /api/orders/:id/rounds', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const validItems = { items: [{ productId: 5, unitPrice: 45, quantity: 2 }] };

  it('adds a round with items', async () => {
    vi.mocked(orderService.addRound).mockResolvedValue({ id: 1, roundNumber: 1, items: [] } as any);

    const res = await request(app)
      .post('/api/orders/1/rounds')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send(validItems);

    expect(res.status).toBe(201);
    expect(orderService.addRound).toHaveBeenCalledWith(1, validItems, 2);
  });

  it('returns 400 when an item has neither productId nor customName', async () => {
    const res = await request(app)
      .post('/api/orders/1/rounds')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ items: [{ unitPrice: 10, quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(orderService.addRound).not.toHaveBeenCalled();
  });

  it('returns 400 when an item has both productId and customName', async () => {
    const res = await request(app)
      .post('/api/orders/1/rounds')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ items: [{ productId: 1, customName: 'Extra salsa', unitPrice: 10, quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(orderService.addRound).not.toHaveBeenCalled();
  });

  it('returns 400 when items array is empty', async () => {
    const res = await request(app)
      .post('/api/orders/1/rounds')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ items: [] });

    expect(res.status).toBe(400);
    expect(orderService.addRound).not.toHaveBeenCalled();
  });

  it('returns 409 when the order is not open', async () => {
    vi.mocked(orderService.addRound).mockRejectedValue(new Error(ORDER_ERRORS.ORDER_NOT_OPEN));

    const res = await request(app)
      .post('/api/orders/1/rounds')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send(validItems);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(ORDER_ERRORS.ORDER_NOT_OPEN);
  });
});

// ─── PUT /orders/:id/rounds/:roundId/items/:itemId ────────────────────────────

describe('PUT /api/orders/:id/rounds/:roundId/items/:itemId', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('updates an item', async () => {
    vi.mocked(orderService.updateItem).mockResolvedValue({ id: 10, quantity: 3 } as any);

    const res = await request(app)
      .put('/api/orders/1/rounds/2/items/10')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ quantity: 3 });

    expect(res.status).toBe(200);
    expect(orderService.updateItem).toHaveBeenCalledWith(1, 2, 10, { quantity: 3 });
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .put('/api/orders/1/rounds/2/items/10')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(orderService.updateItem).not.toHaveBeenCalled();
  });

  it('returns 404 when the item does not belong to the round', async () => {
    vi.mocked(orderService.updateItem).mockRejectedValue(new Error(ORDER_ERRORS.ITEM_NOT_FOUND));

    const res = await request(app)
      .put('/api/orders/1/rounds/2/items/999')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(ORDER_ERRORS.ITEM_NOT_FOUND);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).put('/api/orders/1/rounds/2/items/10').send({ quantity: 1 });

    expect(res.status).toBe(401);
    expect(orderService.updateItem).not.toHaveBeenCalled();
  });
});

// ─── DELETE /orders/:id/rounds/:roundId/items/:itemId ─────────────────────────

describe('DELETE /api/orders/:id/rounds/:roundId/items/:itemId', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('deletes an item', async () => {
    vi.mocked(orderService.deleteItem).mockResolvedValue(undefined as any);

    const res = await request(app)
      .delete('/api/orders/1/rounds/2/items/10')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Item deleted successfully');
    expect(orderService.deleteItem).toHaveBeenCalledWith(1, 2, 10);
  });

  it('returns 409 when the order is not open', async () => {
    vi.mocked(orderService.deleteItem).mockRejectedValue(new Error(ORDER_ERRORS.ORDER_NOT_OPEN));

    const res = await request(app)
      .delete('/api/orders/1/rounds/2/items/10')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(ORDER_ERRORS.ORDER_NOT_OPEN);
  });
});

// ─── DELETE /orders/:id/rounds/:roundId ────────────────────────────────────────

describe('DELETE /api/orders/:id/rounds/:roundId', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('deletes a round', async () => {
    vi.mocked(orderService.deleteRound).mockResolvedValue(undefined as any);

    const res = await request(app)
      .delete('/api/orders/1/rounds/2')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Round deleted successfully');
    expect(orderService.deleteRound).toHaveBeenCalledWith(1, 2);
  });

  it('returns 404 when the round does not belong to the order', async () => {
    vi.mocked(orderService.deleteRound).mockRejectedValue(new Error(ORDER_ERRORS.ROUND_NOT_FOUND));

    const res = await request(app)
      .delete('/api/orders/1/rounds/2')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(ORDER_ERRORS.ROUND_NOT_FOUND);
  });

  it('returns 409 when the order is not open', async () => {
    vi.mocked(orderService.deleteRound).mockRejectedValue(new Error(ORDER_ERRORS.ORDER_NOT_OPEN));

    const res = await request(app)
      .delete('/api/orders/1/rounds/2')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(ORDER_ERRORS.ORDER_NOT_OPEN);
  });
});

// ─── POST /orders/:id/cancel ──────────────────────────────────────────────────

describe('POST /api/orders/:id/cancel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('cancels an open order', async () => {
    vi.mocked(orderService.cancelOrder).mockResolvedValue({ ...mockOrder, status: 'cancelled' } as any);

    const res = await request(app).post('/api/orders/1/cancel').set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
    expect(orderService.cancelOrder).toHaveBeenCalledWith(1);
  });

  it('returns 409 when the order is already closed', async () => {
    vi.mocked(orderService.cancelOrder).mockRejectedValue(new Error(ORDER_ERRORS.ORDER_NOT_OPEN));

    const res = await request(app).post('/api/orders/1/cancel').set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(ORDER_ERRORS.ORDER_NOT_OPEN);
  });

  it('returns 404 when the order does not exist', async () => {
    vi.mocked(orderService.cancelOrder).mockRejectedValue(new Error(ORDER_ERRORS.ORDER_NOT_FOUND));

    const res = await request(app).post('/api/orders/999/cancel').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(ORDER_ERRORS.ORDER_NOT_FOUND);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/orders/1/cancel');

    expect(res.status).toBe(401);
    expect(orderService.cancelOrder).not.toHaveBeenCalled();
  });
});

// ─── POST /orders/:id/charge ───────────────────────────────────────────────────

describe('POST /api/orders/:id/charge', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('charges an order without a discount', async () => {
    vi.mocked(orderService.chargeOrder).mockResolvedValue({ ...mockOrder, status: 'charged' } as any);

    const res = await request(app).post('/api/orders/1/charge').set('Authorization', `Bearer ${waiterToken}`).send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('charged');
    expect(orderService.chargeOrder).toHaveBeenCalledWith(1, {});
  });

  it('charges an order with a percentage discount', async () => {
    vi.mocked(orderService.chargeOrder).mockResolvedValue({
      ...mockOrder,
      status: 'charged',
      discounts: [{ id: 1, description: 'Promo', type: 'percentage', value: 10, amount: 5 }],
    } as any);

    const body = { discount: { description: 'Promo', type: 'percentage', value: 10 } };
    const res = await request(app).post('/api/orders/1/charge').set('Authorization', `Bearer ${waiterToken}`).send(body);

    expect(res.status).toBe(200);
    expect(orderService.chargeOrder).toHaveBeenCalledWith(1, body);
  });

  it('returns 400 when the discount value is zero', async () => {
    const res = await request(app)
      .post('/api/orders/1/charge')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ discount: { description: 'Promo', type: 'fixed', value: 0 } });

    expect(res.status).toBe(400);
    expect(orderService.chargeOrder).not.toHaveBeenCalled();
  });

  it('returns 400 when a percentage discount exceeds 100', async () => {
    const res = await request(app)
      .post('/api/orders/1/charge')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ discount: { description: 'Promo', type: 'percentage', value: 101 } });

    expect(res.status).toBe(400);
    expect(orderService.chargeOrder).not.toHaveBeenCalled();
  });

  it('returns 400 when the discount is missing a description', async () => {
    const res = await request(app)
      .post('/api/orders/1/charge')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ discount: { type: 'fixed', value: 10 } });

    expect(res.status).toBe(400);
    expect(orderService.chargeOrder).not.toHaveBeenCalled();
  });

  it('returns 400 when the discount value has more than 2 decimal places', async () => {
    const res = await request(app)
      .post('/api/orders/1/charge')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ discount: { description: 'Promo', type: 'fixed', value: 10.555 } });

    expect(res.status).toBe(400);
    expect(orderService.chargeOrder).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-numeric id', async () => {
    const res = await request(app).post('/api/orders/abc/charge').set('Authorization', `Bearer ${waiterToken}`).send({});

    expect(res.status).toBe(400);
    expect(orderService.chargeOrder).not.toHaveBeenCalled();
  });

  it('returns 404 when the order does not exist', async () => {
    vi.mocked(orderService.chargeOrder).mockRejectedValue(new Error(ORDER_ERRORS.ORDER_NOT_FOUND));

    const res = await request(app).post('/api/orders/999/charge').set('Authorization', `Bearer ${waiterToken}`).send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(ORDER_ERRORS.ORDER_NOT_FOUND);
  });

  it('returns 409 when the order is not open', async () => {
    vi.mocked(orderService.chargeOrder).mockRejectedValue(new Error(ORDER_ERRORS.ORDER_NOT_OPEN));

    const res = await request(app).post('/api/orders/1/charge').set('Authorization', `Bearer ${waiterToken}`).send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(ORDER_ERRORS.ORDER_NOT_OPEN);
  });

  it('returns 409 when the order has no items', async () => {
    vi.mocked(orderService.chargeOrder).mockRejectedValue(new Error(ORDER_ERRORS.ORDER_EMPTY));

    const res = await request(app).post('/api/orders/1/charge').set('Authorization', `Bearer ${waiterToken}`).send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(ORDER_ERRORS.ORDER_EMPTY);
  });

  it('returns 409 when a fixed discount exceeds the subtotal', async () => {
    vi.mocked(orderService.chargeOrder).mockRejectedValue(new Error(ORDER_ERRORS.DISCOUNT_EXCEEDS_SUBTOTAL));

    const res = await request(app)
      .post('/api/orders/1/charge')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ discount: { description: 'Promo', type: 'fixed', value: 999 } });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(ORDER_ERRORS.DISCOUNT_EXCEEDS_SUBTOTAL);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/orders/1/charge').send({});

    expect(res.status).toBe(401);
    expect(orderService.chargeOrder).not.toHaveBeenCalled();
  });
});
