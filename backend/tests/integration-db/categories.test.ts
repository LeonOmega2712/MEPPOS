import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { generateAccessToken } from '../../src/lib/jwt';
import { resetDb, prisma } from './helpers/db';

// Tokens for authenticated requests
const adminToken = generateAccessToken({ userId: 1, username: 'admin', role: 'ADMIN' });
const waiterToken = generateAccessToken({ userId: 2, username: 'waiter', role: 'WAITER' });

// Helper: shorthand for authenticated requests
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

describe('POST /api/categories', () => {
  it('creates a category with auto displayOrder', async () => {
    const res = await api.post('/api/categories', { name: 'Mariscos' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Mariscos');
    expect(res.body.data.displayOrder).toBe(0);
    expect(res.body.data.active).toBe(true);
  });

  it('auto-increments displayOrder for each new category', async () => {
    await api.post('/api/categories', { name: 'First' });
    await api.post('/api/categories', { name: 'Second' });
    const res = await api.post('/api/categories', { name: 'Third' });

    expect(res.body.data.displayOrder).toBe(2);
  });

  it('returns 409 on duplicate name', async () => {
    await api.post('/api/categories', { name: 'Mariscos' });
    const res = await api.post('/api/categories', { name: 'Mariscos' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Category name already exists');
  });

  it('returns 400 when name is missing', async () => {
    const res = await api.post('/api/categories', {});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  it('returns 403 when a WAITER tries to create', async () => {
    const res = await api.post('/api/categories', { name: 'Mariscos' }, waiterToken);

    expect(res.status).toBe(403);
  });
});

// ----- READ -----

describe('GET /api/categories', () => {
  beforeEach(async () => {
    await prisma.category.createMany({
      data: [
        { name: 'Active 1', displayOrder: 0, active: true },
        { name: 'Active 2', displayOrder: 1, active: true },
        { name: 'Inactive', displayOrder: 2, active: false },
      ],
    });
  });

  it('returns all categories ordered by displayOrder', async () => {
    const res = await api.get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
    expect(res.body.data[0].name).toBe('Active 1');
    expect(res.body.data[2].name).toBe('Inactive');
  });

  it('filters active-only with ?active=true', async () => {
    const res = await api.get('/api/categories?active=true');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.data.every((c: any) => c.active)).toBe(true);
  });

  it('includes product count (_count)', async () => {
    const res = await api.get('/api/categories');

    expect(res.body.data[0]._count).toHaveProperty('products');
  });

  it('WAITER can read categories', async () => {
    const res = await api.get('/api/categories', waiterToken);

    expect(res.status).toBe(200);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(401);
  });
});

describe('GET /api/categories/:id', () => {
  it('returns category with its products', async () => {
    const cat = await prisma.category.create({
      data: { name: 'Mariscos', displayOrder: 0 },
    });
    await prisma.product.create({
      data: { name: 'Camarón', categoryId: cat.id, displayOrder: 0 },
    });

    const res = await api.get(`/api/categories/${cat.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Mariscos');
    expect(res.body.data.products).toHaveLength(1);
    expect(res.body.data.products[0].name).toBe('Camarón');
  });

  it('returns 404 for non-existent ID', async () => {
    const res = await api.get('/api/categories/999');

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid ID format', async () => {
    const res = await api.get('/api/categories/abc');

    expect(res.status).toBe(400);
  });
});

// ----- UPDATE -----

describe('PUT /api/categories/:id', () => {
  it('updates a category', async () => {
    const cat = await prisma.category.create({
      data: { name: 'Old Name', displayOrder: 0 },
    });

    const res = await api.put(`/api/categories/${cat.id}`, {
      name: 'New Name',
      description: 'Updated description',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Name');
    expect(res.body.data.description).toBe('Updated description');
  });

  it('returns 404 when category does not exist', async () => {
    const res = await api.put('/api/categories/999', { name: 'X' });

    expect(res.status).toBe(404);
  });

  it('returns 409 on duplicate name', async () => {
    await prisma.category.createMany({
      data: [
        { name: 'A', displayOrder: 0 },
        { name: 'B', displayOrder: 1 },
      ],
    });
    const catB = await prisma.category.findFirst({ where: { name: 'B' } });

    const res = await api.put(`/api/categories/${catB!.id}`, { name: 'A' });

    expect(res.status).toBe(409);
  });
});

// ----- SOFT DELETE -----

describe('DELETE /api/categories/:id (soft)', () => {
  it('deactivates category and cascades to its products', async () => {
    const cat = await prisma.category.create({
      data: { name: 'Mariscos', displayOrder: 0 },
    });
    await prisma.product.create({
      data: { name: 'Camarón', categoryId: cat.id, displayOrder: 0, active: true },
    });

    const res = await api.delete(`/api/categories/${cat.id}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Category deactivated successfully');

    // Verify in DB: both category and product are now inactive
    const dbCat = await prisma.category.findUnique({ where: { id: cat.id } });
    const dbProd = await prisma.product.findFirst({ where: { categoryId: cat.id } });
    expect(dbCat!.active).toBe(false);
    expect(dbProd!.active).toBe(false);
  });

  it('closes displayOrder gaps after deactivation', async () => {
    await prisma.category.createMany({
      data: [
        { name: 'A', displayOrder: 0, active: true },
        { name: 'B', displayOrder: 1, active: true },
        { name: 'C', displayOrder: 2, active: true },
      ],
    });
    const catB = await prisma.category.findFirst({ where: { name: 'B' } });

    await api.delete(`/api/categories/${catB!.id}`);

    // After deactivating B, active categories should be re-indexed: A=0, C=1
    const active = await prisma.category.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
    });
    expect(active).toHaveLength(2);
    expect(active[0].name).toBe('A');
    expect(active[0].displayOrder).toBe(0);
    expect(active[1].name).toBe('C');
    expect(active[1].displayOrder).toBe(1);
  });

  it('returns 404 for non-existent category', async () => {
    const res = await api.delete('/api/categories/999');

    expect(res.status).toBe(404);
  });
});

// ----- HARD DELETE -----

describe('DELETE /api/categories/:id?permanent=true', () => {
  it('permanently deletes the category and its products (cascade)', async () => {
    const cat = await prisma.category.create({
      data: { name: 'Mariscos', displayOrder: 0 },
    });
    await prisma.product.create({
      data: { name: 'Camarón', categoryId: cat.id, displayOrder: 0 },
    });

    const res = await api.delete(`/api/categories/${cat.id}?permanent=true`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Category permanently deleted');

    // Both category and product are gone from the DB
    const dbCat = await prisma.category.findUnique({ where: { id: cat.id } });
    const dbProd = await prisma.product.findFirst({ where: { categoryId: cat.id } });
    expect(dbCat).toBeNull();
    expect(dbProd).toBeNull();
  });
});

// ----- REORDER -----

describe('PATCH /api/categories/reorder', () => {
  it('reorders categories atomically', async () => {
    await prisma.category.createMany({
      data: [
        { name: 'A', displayOrder: 0, active: true },
        { name: 'B', displayOrder: 1, active: true },
        { name: 'C', displayOrder: 2, active: true },
      ],
    });
    const cats = await prisma.category.findMany({ orderBy: { displayOrder: 'asc' } });
    const [a, b, c] = cats;

    // Reverse the order: C, B, A
    const res = await api.patch('/api/categories/reorder', {
      categoryIds: [c.id, b.id, a.id],
    });

    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(3);

    // Verify new order in DB
    const reordered = await prisma.category.findMany({ orderBy: { displayOrder: 'asc' } });
    expect(reordered[0].name).toBe('C');
    expect(reordered[1].name).toBe('B');
    expect(reordered[2].name).toBe('A');
  });

  it('returns 400 on duplicate IDs', async () => {
    const res = await api.patch('/api/categories/reorder', {
      categoryIds: [1, 2, 1],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Duplicate');
  });

  it('returns 400 when IDs do not exist', async () => {
    const res = await api.patch('/api/categories/reorder', {
      categoryIds: [999, 998],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid category IDs');
  });
});
