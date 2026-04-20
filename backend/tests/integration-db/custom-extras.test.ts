import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { generateAccessToken } from '../../src/lib/jwt';
import { resetDb, prisma } from './helpers/db';

const adminToken = generateAccessToken({ userId: 1, username: 'admin', role: 'ADMIN' });
const waiterToken = generateAccessToken({ userId: 2, username: 'waiter', role: 'WAITER' });

const api = {
  get: (path: string, token = adminToken) =>
    request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body: object, token = adminToken) =>
    request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path: string, body: object, token = adminToken) =>
    request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path: string, token = adminToken) =>
    request(app).delete(path).set('Authorization', `Bearer ${token}`),
};

async function seedUser() {
  await prisma.user.create({
    data: { username: 'admin', password: 'placeholder', displayName: 'Admin', role: 'ADMIN' },
  });
  await prisma.user.create({
    data: { username: 'waiter', password: 'placeholder', displayName: 'Waiter', role: 'WAITER' },
  });
}

beforeEach(async () => {
  await resetDb();
  await seedUser();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ----- CREATE -----

describe('POST /api/extras', () => {
  it('creates an extra with name and defaultPrice', async () => {
    const res = await api.post('/api/extras', { name: 'Aguacate', defaultPrice: 15.5 });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Aguacate');
    expect(Number(res.body.data.defaultPrice)).toBe(15.5);
    expect(res.body.data.active).toBe(true);
  });

  it('returns 400 when defaultPrice is missing', async () => {
    const res = await api.post('/api/extras', { name: 'Limón' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  it('returns 409 on duplicate name', async () => {
    await api.post('/api/extras', { name: 'Limón', defaultPrice: 5 });
    const res = await api.post('/api/extras', { name: 'Limón', defaultPrice: 5 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('An extra with that name already exists');
  });

  it('returns 400 when name is missing', async () => {
    const res = await api.post('/api/extras', { defaultPrice: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  it('returns 400 when defaultPrice is zero', async () => {
    const res = await api.post('/api/extras', { name: 'Limón2', defaultPrice: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  it('returns 400 when defaultPrice is negative', async () => {
    const res = await api.post('/api/extras', { name: 'Limón3', defaultPrice: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  it('WAITER can create an extra', async () => {
    const res = await api.post('/api/extras', { name: 'Salsa', defaultPrice: 7 }, waiterToken);

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Salsa');
  });
});

// ----- READ -----

describe('GET /api/extras', () => {
  beforeEach(async () => {
    await prisma.customExtra.createMany({
      data: [
        { name: 'Zanahoria', defaultPrice: 10, active: true },
        { name: 'Aguacate', defaultPrice: 12, active: true },
        { name: 'Obsoleto', defaultPrice: 5, active: false },
      ],
    });
  });

  it('returns all extras sorted alphabetically by name', async () => {
    const res = await api.get('/api/extras');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
    expect(res.body.data[0].name).toBe('Aguacate');
    expect(res.body.data[1].name).toBe('Obsoleto');
    expect(res.body.data[2].name).toBe('Zanahoria');
  });

  it('filters to active extras when ?active=true', async () => {
    const res = await api.get('/api/extras?active=true');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    const names = res.body.data.map((e: any) => e.name);
    expect(names).not.toContain('Obsoleto');
  });

  it('WAITER can read extras', async () => {
    const res = await api.get('/api/extras', waiterToken);

    expect(res.status).toBe(200);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/extras');

    expect(res.status).toBe(401);
  });
});

// ----- UPDATE -----

describe('PUT /api/extras/:id', () => {
  it('updates the name of an extra', async () => {
    const extra = await prisma.customExtra.create({ data: { name: 'Viejo', defaultPrice: 5 } });

    const res = await api.put(`/api/extras/${extra.id}`, { name: 'Nuevo' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Nuevo');
  });

  it('updates defaultPrice to a new value', async () => {
    const extra = await prisma.customExtra.create({ data: { name: 'Limón', defaultPrice: 5 } });

    const res = await api.put(`/api/extras/${extra.id}`, { defaultPrice: 10 });

    expect(res.status).toBe(200);
    expect(Number(res.body.data.defaultPrice)).toBe(10);
  });

  it('rejects null defaultPrice', async () => {
    const extra = await prisma.customExtra.create({
      data: { name: 'LimónNull', defaultPrice: 5 },
    });

    const res = await api.put(`/api/extras/${extra.id}`, { defaultPrice: null });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  it('returns 404 for non-existent ID', async () => {
    const res = await api.put('/api/extras/999', { name: 'X' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Extra not found');
  });

  it('returns 409 on duplicate name', async () => {
    await prisma.customExtra.createMany({
      data: [{ name: 'Alpha', defaultPrice: 5 }, { name: 'Beta', defaultPrice: 5 }],
    });
    const beta = await prisma.customExtra.findFirst({ where: { name: 'Beta' } });

    const res = await api.put(`/api/extras/${beta!.id}`, { name: 'Alpha' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('An extra with that name already exists');
  });
});

// ----- SOFT DELETE -----

describe('DELETE /api/extras/:id (soft)', () => {
  it('sets active=false in DB but does not remove the row', async () => {
    const extra = await prisma.customExtra.create({ data: { name: 'Limón', defaultPrice: 5 } });

    const res = await api.delete(`/api/extras/${extra.id}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Extra deactivated successfully');

    const dbExtra = await prisma.customExtra.findUnique({ where: { id: extra.id } });
    expect(dbExtra).not.toBeNull();
    expect(dbExtra!.active).toBe(false);
  });

  it('returns 404 for non-existent ID', async () => {
    const res = await api.delete('/api/extras/999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Extra not found');
  });
});

// ----- HARD DELETE -----

describe('DELETE /api/extras/:id?permanent=true', () => {
  it('removes the row from DB entirely', async () => {
    const extra = await prisma.customExtra.create({ data: { name: 'Limón', defaultPrice: 5 } });

    const res = await api.delete(`/api/extras/${extra.id}?permanent=true`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Extra permanently deleted');

    const dbExtra = await prisma.customExtra.findUnique({ where: { id: extra.id } });
    expect(dbExtra).toBeNull();
  });

  it('returns 404 for non-existent ID', async () => {
    const res = await api.delete('/api/extras/999?permanent=true');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Extra not found');
  });
});

// ----- AUTH -----

describe('Auth: extras are accessible to any authenticated user', () => {
  it('WAITER can update an extra', async () => {
    const extra = await prisma.customExtra.create({ data: { name: 'Limón', defaultPrice: 5 } });

    const res = await api.put(`/api/extras/${extra.id}`, { name: 'Limón Extra' }, waiterToken);

    expect(res.status).toBe(200);
  });

  it('WAITER can soft-delete an extra', async () => {
    const extra = await prisma.customExtra.create({ data: { name: 'Limón', defaultPrice: 5 } });

    const res = await api.delete(`/api/extras/${extra.id}`, waiterToken);

    expect(res.status).toBe(200);
  });

  it('returns 401 without token on create', async () => {
    const res = await request(app).post('/api/extras').send({ name: 'Limón', defaultPrice: 5 });

    expect(res.status).toBe(401);
  });
});
