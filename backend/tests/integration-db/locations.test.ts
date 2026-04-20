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
  patch: (path: string, body: object, token = adminToken) =>
    request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body),
};

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ----- CREATE -----

describe('POST /api/locations', () => {
  it('creates a table location with displayOrder 0 as the first entry', async () => {
    const res = await api.post('/api/locations', { name: 'Mesa 1', type: 'table' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Mesa 1');
    expect(res.body.data.type).toBe('table');
    expect(res.body.data.displayOrder).toBe(0);
    expect(res.body.data.active).toBe(true);
  });

  it('creates a bar location', async () => {
    const res = await api.post('/api/locations', { name: 'Barra 1', type: 'bar' });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('bar');
  });

  it('auto-increments displayOrder for each new location', async () => {
    await api.post('/api/locations', { name: 'Mesa 1', type: 'table' });
    await api.post('/api/locations', { name: 'Mesa 2', type: 'table' });
    const res = await api.post('/api/locations', { name: 'Mesa 3', type: 'table' });

    expect(res.body.data.displayOrder).toBe(2);
  });

  it('returns 400 on invalid type', async () => {
    const res = await api.post('/api/locations', { name: 'Booth 1', type: 'booth' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  it('returns 400 when name is missing', async () => {
    const res = await api.post('/api/locations', { type: 'table' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  it('returns 403 for WAITER', async () => {
    const res = await api.post('/api/locations', { name: 'Mesa 1', type: 'table' }, waiterToken);

    expect(res.status).toBe(403);
  });
});

// ----- READ -----

describe('GET /api/locations', () => {
  beforeEach(async () => {
    await prisma.location.createMany({
      data: [
        { name: 'Mesa 1', type: 'table', displayOrder: 0, active: true },
        { name: 'Barra 1', type: 'bar', displayOrder: 1, active: true },
        { name: 'Mesa Inactiva', type: 'table', displayOrder: 2, active: false },
      ],
    });
  });

  it('returns all locations ordered by displayOrder', async () => {
    const res = await api.get('/api/locations');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
    expect(res.body.data[0].name).toBe('Mesa 1');
    expect(res.body.data[1].name).toBe('Barra 1');
    expect(res.body.data[2].name).toBe('Mesa Inactiva');
  });

  it('includes inactive locations (no active filter by default)', async () => {
    const res = await api.get('/api/locations');

    const names = res.body.data.map((l: any) => l.name);
    expect(names).toContain('Mesa Inactiva');
  });

  it('WAITER can read locations', async () => {
    const res = await api.get('/api/locations', waiterToken);

    expect(res.status).toBe(200);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/locations');

    expect(res.status).toBe(401);
  });
});

// ----- UPDATE -----

describe('PUT /api/locations/:id', () => {
  it('updates the name of a location', async () => {
    const loc = await prisma.location.create({
      data: { name: 'Mesa 1', type: 'table', displayOrder: 0 },
    });

    const res = await api.put(`/api/locations/${loc.id}`, { name: 'Mesa VIP' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Mesa VIP');
  });

  it('updates type from table to bar', async () => {
    const loc = await prisma.location.create({
      data: { name: 'Mesa 1', type: 'table', displayOrder: 0 },
    });

    const res = await api.put(`/api/locations/${loc.id}`, { type: 'bar' });

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('bar');
  });

  it('returns 404 for non-existent ID', async () => {
    const res = await api.put('/api/locations/999', { name: 'X' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Location not found');
  });

  it('returns 400 for invalid ID format', async () => {
    const res = await api.put('/api/locations/abc', { name: 'X' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid location ID');
  });
});

// ----- SOFT DELETE -----

describe('DELETE /api/locations/:id (soft)', () => {
  it('sets active=false but keeps the row in DB', async () => {
    const loc = await prisma.location.create({
      data: { name: 'Mesa 1', type: 'table', displayOrder: 0 },
    });

    const res = await api.delete(`/api/locations/${loc.id}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Location deactivated successfully');

    const dbLoc = await prisma.location.findUnique({ where: { id: loc.id } });
    expect(dbLoc).not.toBeNull();
    expect(dbLoc!.active).toBe(false);
  });

  it('closes displayOrder gaps after deactivation', async () => {
    await prisma.location.createMany({
      data: [
        { name: 'A', type: 'table', displayOrder: 0, active: true },
        { name: 'B', type: 'table', displayOrder: 1, active: true },
        { name: 'C', type: 'table', displayOrder: 2, active: true },
      ],
    });
    const locB = await prisma.location.findFirst({ where: { name: 'B' } });

    await api.delete(`/api/locations/${locB!.id}`);

    const active = await prisma.location.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
    });
    expect(active).toHaveLength(2);
    expect(active[0].name).toBe('A');
    expect(active[0].displayOrder).toBe(0);
    expect(active[1].name).toBe('C');
    expect(active[1].displayOrder).toBe(1);
  });

  it('returns 404 for non-existent ID', async () => {
    const res = await api.delete('/api/locations/999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Location not found');
  });

  it('returns 403 for WAITER', async () => {
    const loc = await prisma.location.create({
      data: { name: 'Mesa 1', type: 'table', displayOrder: 0 },
    });

    const res = await api.delete(`/api/locations/${loc.id}`, waiterToken);

    expect(res.status).toBe(403);
  });
});

// ----- HARD DELETE -----

describe('DELETE /api/locations/:id?permanent=true', () => {
  it('removes the row from DB entirely', async () => {
    const loc = await prisma.location.create({
      data: { name: 'Mesa 1', type: 'table', displayOrder: 0 },
    });

    const res = await api.delete(`/api/locations/${loc.id}?permanent=true`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Location permanently deleted');

    const dbLoc = await prisma.location.findUnique({ where: { id: loc.id } });
    expect(dbLoc).toBeNull();
  });

  it('returns 403 for WAITER', async () => {
    const loc = await prisma.location.create({
      data: { name: 'Mesa 1', type: 'table', displayOrder: 0 },
    });

    const res = await api.delete(`/api/locations/${loc.id}?permanent=true`, waiterToken);

    expect(res.status).toBe(403);
  });
});

// ----- REORDER -----

describe('PATCH /api/locations/reorder', () => {
  it('reorders locations by setting displayOrder equal to the array index', async () => {
    await prisma.location.createMany({
      data: [
        { name: 'A', type: 'table', displayOrder: 0, active: true },
        { name: 'B', type: 'table', displayOrder: 1, active: true },
        { name: 'C', type: 'table', displayOrder: 2, active: true },
      ],
    });
    const locs = await prisma.location.findMany({ orderBy: { displayOrder: 'asc' } });
    const [a, b, c] = locs;

    const res = await api.patch('/api/locations/reorder', {
      locationIds: [c.id, b.id, a.id],
    });

    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(3);

    const reordered = await prisma.location.findMany({ orderBy: { displayOrder: 'asc' } });
    expect(reordered[0].name).toBe('C');
    expect(reordered[1].name).toBe('B');
    expect(reordered[2].name).toBe('A');
  });

  it('returns 400 on duplicate IDs in the request body', async () => {
    const res = await api.patch('/api/locations/reorder', {
      locationIds: [1, 2, 1],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Duplicate');
  });

  it('returns 400 when IDs do not exist', async () => {
    const res = await api.patch('/api/locations/reorder', {
      locationIds: [999, 998],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid location IDs');
  });

  it('returns 403 for WAITER', async () => {
    const res = await api.patch('/api/locations/reorder', { locationIds: [1] }, waiterToken);

    expect(res.status).toBe(403);
  });
});

