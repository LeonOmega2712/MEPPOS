import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { generateAccessToken } from '../../src/lib/jwt';
import { resetDb, prisma } from './helpers/db';

const adminToken = generateAccessToken({ userId: 1, username: 'admin', role: 'ADMIN' });
const waiterToken = generateAccessToken({ userId: 2, username: 'waiter', role: 'WAITER' });

const api = {
  get: (path: string, token = waiterToken) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body: object = {}, token = waiterToken) =>
    request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path: string, body: object, token = waiterToken) =>
    request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path: string, token = waiterToken) =>
    request(app).delete(path).set('Authorization', `Bearer ${token}`),
};

async function seedUsers() {
  await prisma.user.create({
    data: { username: 'admin', password: 'placeholder', displayName: 'Admin', role: 'ADMIN' },
  });
  await prisma.user.create({
    data: { username: 'waiter', password: 'placeholder', displayName: 'Waiter', role: 'WAITER' },
  });
}

async function seedLocations() {
  const table = await prisma.location.create({ data: { name: 'Mesa 1', type: 'table', displayOrder: 0 } });
  const bar = await prisma.location.create({ data: { name: 'Barra', type: 'bar', displayOrder: 1 } });
  return { table, bar };
}

async function seedProduct() {
  const category = await prisma.category.create({ data: { name: 'Mariscos', displayOrder: 0 } });
  return prisma.product.create({
    data: { categoryId: category.id, name: 'Coctel de camarón', price: 120, displayOrder: 0 },
  });
}

beforeEach(async () => {
  await resetDb();
  await seedUsers();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ----- OPEN ORDER -----

describe('POST /api/orders', () => {
  it('opens a dine-in order on an available table', async () => {
    const { table } = await seedLocations();

    const res = await api.post('/api/orders', { locationId: table.id });

    expect(res.status).toBe(201);
    expect(res.body.data.locationId).toBe(table.id);
    expect(res.body.data.status).toBe('open');
    expect(res.body.data.ownerUserId).toBe(2);
    expect(res.body.data.barPosition).toBeNull();
    expect(res.body.data.takeoutNumber).toBeNull();
  });

  it('rejects a second dine-in order on an already-occupied table', async () => {
    const { table } = await seedLocations();
    await api.post('/api/orders', { locationId: table.id });

    const res = await api.post('/api/orders', { locationId: table.id });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Location already has an open order');
  });

  it('assigns incrementing bar positions and allows multiple simultaneous bar orders', async () => {
    const { bar } = await seedLocations();

    const first = await api.post('/api/orders', { locationId: bar.id });
    const second = await api.post('/api/orders', { locationId: bar.id });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.barPosition).toBe(1);
    expect(second.body.data.barPosition).toBe(2);
  });

  it('assigns incrementing takeout numbers without a location', async () => {
    const first = await api.post('/api/orders', {});
    const second = await api.post('/api/orders', {});

    expect(first.body.data.takeoutNumber).toBe(1);
    expect(second.body.data.takeoutNumber).toBe(2);
    expect(first.body.data.locationId).toBeNull();
  });

  it('returns 404 when the location does not exist', async () => {
    const res = await api.post('/api/orders', { locationId: 999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Location not found');
  });

  it('returns 409 when the location is inactive', async () => {
    const inactive = await prisma.location.create({
      data: { name: 'Mesa Vieja', type: 'table', displayOrder: 0, active: false },
    });

    const res = await api.post('/api/orders', { locationId: inactive.id });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Location is not active');
  });

  it('returns 400 on an invalid locationId', async () => {
    const res = await api.post('/api/orders', { locationId: 'not-a-number' });

    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/orders').send({});

    expect(res.status).toBe(401);
  });
});

// ----- LOCATION OCCUPANCY -----

describe('GET /api/locations occupancy', () => {
  it('marks a table occupied while it has an open order, and free again after cancel', async () => {
    const { table } = await seedLocations();

    const before = await api.get('/api/locations');
    expect(before.body.data.find((l: any) => l.id === table.id).occupied).toBe(false);

    const order = await api.post('/api/orders', { locationId: table.id });
    const during = await api.get('/api/locations');
    expect(during.body.data.find((l: any) => l.id === table.id).occupied).toBe(true);

    await api.post(`/api/orders/${order.body.data.id}/cancel`);
    const after = await api.get('/api/locations');
    expect(after.body.data.find((l: any) => l.id === table.id).occupied).toBe(false);
  });

  it('never marks a bar location as occupied', async () => {
    const { bar } = await seedLocations();
    await api.post('/api/orders', { locationId: bar.id });

    const res = await api.get('/api/locations');

    expect(res.body.data.find((l: any) => l.id === bar.id).occupied).toBe(false);
  });
});

// ----- LIST / DETAIL -----

describe('GET /api/orders', () => {
  it('lists only open orders and supports ?mine=true', async () => {
    const { table, bar } = await seedLocations();
    const mine = await api.post('/api/orders', { locationId: table.id }, waiterToken);
    const admins = await api.post('/api/orders', { locationId: bar.id }, adminToken);
    await api.post(`/api/orders/${mine.body.data.id}/cancel`, {}, waiterToken);

    const all = await api.get('/api/orders', waiterToken);
    expect(all.body.data.map((o: any) => o.id)).toEqual([admins.body.data.id]);

    const onlyMine = await api.get('/api/orders?mine=true', adminToken);
    expect(onlyMine.body.data.map((o: any) => o.id)).toEqual([admins.body.data.id]);
  });
});

describe('GET /api/orders/:id', () => {
  it('returns full detail with rounds, items and computed totals', async () => {
    const { table } = await seedLocations();
    const product = await seedProduct();
    const order = await api.post('/api/orders', { locationId: table.id });
    const orderId = order.body.data.id;

    await api.post(`/api/orders/${orderId}/rounds`, {
      items: [
        { productId: product.id, unitPrice: 120, quantity: 2 },
        { customName: 'Refresco extra', unitPrice: 25, quantity: 1 },
      ],
    });

    const res = await api.get(`/api/orders/${orderId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.rounds).toHaveLength(1);
    expect(res.body.data.rounds[0].roundNumber).toBe(1);
    expect(res.body.data.rounds[0].items).toHaveLength(2);
    expect(Number(res.body.data.rounds[0].items[0].subtotal)).toBe(240);
    expect(res.body.data.subtotal).toBe(265);
    expect(res.body.data.total).toBe(265);
  });

  it('returns 404 for a non-existent order', async () => {
    const res = await api.get('/api/orders/999');

    expect(res.status).toBe(404);
  });
});

// ----- ROUNDS -----

describe('POST /api/orders/:id/rounds', () => {
  it('increments roundNumber for each new round', async () => {
    const { table } = await seedLocations();
    const order = await api.post('/api/orders', { locationId: table.id });
    const orderId = order.body.data.id;

    await api.post(`/api/orders/${orderId}/rounds`, { items: [{ customName: 'Cerveza', unitPrice: 30, quantity: 2 }] });
    const second = await api.post(`/api/orders/${orderId}/rounds`, {
      items: [{ customName: 'Agua', unitPrice: 20, quantity: 1 }],
    });

    expect(second.body.data.roundNumber).toBe(2);
  });

  it('returns 409 when the order is not open', async () => {
    const { table } = await seedLocations();
    const order = await api.post('/api/orders', { locationId: table.id });
    await api.post(`/api/orders/${order.body.data.id}/cancel`);

    const res = await api.post(`/api/orders/${order.body.data.id}/rounds`, {
      items: [{ customName: 'Cerveza', unitPrice: 30, quantity: 1 }],
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Order is not open');
  });

  it('returns 400 when an item has neither productId nor customName', async () => {
    const { table } = await seedLocations();
    const order = await api.post('/api/orders', { locationId: table.id });

    const res = await api.post(`/api/orders/${order.body.data.id}/rounds`, {
      items: [{ unitPrice: 10, quantity: 1 }],
    });

    expect(res.status).toBe(400);
  });
});

// ----- EDIT / DELETE ITEMS -----

describe('PUT /api/orders/:id/rounds/:roundId/items/:itemId', () => {
  it('updates quantity and recomputes the generated subtotal', async () => {
    const { table } = await seedLocations();
    const order = await api.post('/api/orders', { locationId: table.id });
    const orderId = order.body.data.id;
    const round = await api.post(`/api/orders/${orderId}/rounds`, {
      items: [{ customName: 'Cerveza', unitPrice: 30, quantity: 1 }],
    });
    const item = round.body.data.items[0];

    const res = await api.put(`/api/orders/${orderId}/rounds/${round.body.data.id}/items/${item.id}`, {
      quantity: 4,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.quantity).toBe(4);
    expect(Number(res.body.data.subtotal)).toBe(120);
  });

  it('returns 404 when the item does not belong to the round', async () => {
    const { table } = await seedLocations();
    const order = await api.post('/api/orders', { locationId: table.id });
    const round = await api.post(`/api/orders/${order.body.data.id}/rounds`, {
      items: [{ customName: 'Cerveza', unitPrice: 30, quantity: 1 }],
    });

    const res = await api.put(`/api/orders/${order.body.data.id}/rounds/${round.body.data.id}/items/999999`, {
      quantity: 2,
    });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/orders/:id/rounds/:roundId/items/:itemId', () => {
  it('removes the item from the round', async () => {
    const { table } = await seedLocations();
    const order = await api.post('/api/orders', { locationId: table.id });
    const orderId = order.body.data.id;
    const round = await api.post(`/api/orders/${orderId}/rounds`, {
      items: [{ customName: 'Cerveza', unitPrice: 30, quantity: 1 }],
    });
    const item = round.body.data.items[0];

    const res = await api.delete(`/api/orders/${orderId}/rounds/${round.body.data.id}/items/${item.id}`);
    expect(res.status).toBe(200);

    const dbItem = await prisma.orderItem.findUnique({ where: { id: item.id } });
    expect(dbItem).toBeNull();
  });
});

// ----- CANCEL -----

describe('POST /api/orders/:id/cancel', () => {
  it('cancels an open order and stamps closedAt', async () => {
    const { table } = await seedLocations();
    const order = await api.post('/api/orders', { locationId: table.id });

    const res = await api.post(`/api/orders/${order.body.data.id}/cancel`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
    expect(res.body.data.closedAt).not.toBeNull();
  });

  it('returns 409 when cancelling an already-cancelled order', async () => {
    const { table } = await seedLocations();
    const order = await api.post('/api/orders', { locationId: table.id });
    await api.post(`/api/orders/${order.body.data.id}/cancel`);

    const res = await api.post(`/api/orders/${order.body.data.id}/cancel`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Order is not open');
  });

  it('frees the table so a new dine-in order can be opened', async () => {
    const { table } = await seedLocations();
    const order = await api.post('/api/orders', { locationId: table.id });
    await api.post(`/api/orders/${order.body.data.id}/cancel`);

    const res = await api.post('/api/orders', { locationId: table.id });

    expect(res.status).toBe(201);
  });
});
