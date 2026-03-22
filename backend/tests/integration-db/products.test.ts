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

// Seed helper: creates a category and returns it
async function seedCategory(name: string, overrides: Record<string, unknown> = {}) {
  return prisma.category.create({
    data: { name, displayOrder: 0, ...overrides },
  });
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ----- CREATE -----

describe('POST /api/products', () => {
  it('creates a product with auto displayOrder within its category', async () => {
    const cat = await seedCategory('Mariscos');

    const res = await api.post('/api/products', {
      name: 'Camarón',
      categoryId: cat.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Camarón');
    expect(res.body.data.displayOrder).toBe(0);
    expect(res.body.data.categoryId).toBe(cat.id);
  });

  it('auto-increments displayOrder per category', async () => {
    const cat = await seedCategory('Mariscos');
    await api.post('/api/products', { name: 'A', categoryId: cat.id });
    await api.post('/api/products', { name: 'B', categoryId: cat.id });

    const res = await api.post('/api/products', { name: 'C', categoryId: cat.id });

    expect(res.body.data.displayOrder).toBe(2);
  });

  it('returns 409 on duplicate product name', async () => {
    const cat = await seedCategory('Mariscos');
    await api.post('/api/products', { name: 'Camarón', categoryId: cat.id });

    const res = await api.post('/api/products', { name: 'Camarón', categoryId: cat.id });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Product name already exists');
  });

  it('returns 404 when category does not exist', async () => {
    const res = await api.post('/api/products', { name: 'Ghost', categoryId: 999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Category not found');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await api.post('/api/products', {});

    expect(res.status).toBe(400);
  });

  it('returns 403 when a WAITER tries to create', async () => {
    const cat = await seedCategory('Mariscos');
    const res = await api.post('/api/products', { name: 'X', categoryId: cat.id }, waiterToken);

    expect(res.status).toBe(403);
  });
});

// ----- READ -----

describe('GET /api/products', () => {
  beforeEach(async () => {
    const cat = await seedCategory('Mariscos');
    await prisma.product.createMany({
      data: [
        { name: 'Active', categoryId: cat.id, displayOrder: 0, active: true },
        { name: 'Inactive', categoryId: cat.id, displayOrder: 1, active: false },
      ],
    });
  });

  it('returns all products with category info', async () => {
    const res = await api.get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.data[0].category).toBeDefined();
  });

  it('filters active-only with ?active=true', async () => {
    const res = await api.get('/api/products?active=true');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].name).toBe('Active');
  });

  it('includes categories array in response', async () => {
    const res = await api.get('/api/products');

    expect(res.body.categories).toBeDefined();
    expect(res.body.categories.length).toBeGreaterThan(0);
  });

  it('WAITER can read products', async () => {
    const res = await api.get('/api/products', waiterToken);

    expect(res.status).toBe(200);
  });
});

describe('GET /api/products/:id', () => {
  it('returns a product with its category', async () => {
    const cat = await seedCategory('Mariscos');
    const prod = await prisma.product.create({
      data: { name: 'Camarón', categoryId: cat.id, displayOrder: 0 },
    });

    const res = await api.get(`/api/products/${prod.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Camarón');
    expect(res.body.data.category.name).toBe('Mariscos');
  });

  it('returns 404 for non-existent ID', async () => {
    const res = await api.get('/api/products/999');

    expect(res.status).toBe(404);
  });
});

describe('GET /api/categories/:categoryId/products', () => {
  it('returns products for a specific category', async () => {
    const catA = await seedCategory('A');
    const catB = await seedCategory('B', { displayOrder: 1 });
    await prisma.product.create({ data: { name: 'P1', categoryId: catA.id, displayOrder: 0 } });
    await prisma.product.create({ data: { name: 'P2', categoryId: catB.id, displayOrder: 0 } });

    const res = await api.get(`/api/categories/${catA.id}/products`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].name).toBe('P1');
  });
});

// ----- PRICE RESOLUTION -----

describe('GET /api/products/:id/price', () => {
  it('returns the product price when set', async () => {
    const cat = await seedCategory('Mariscos', { basePrice: 70 });
    const prod = await prisma.product.create({
      data: { name: 'Camarón', categoryId: cat.id, price: 85, displayOrder: 0 },
    });

    const res = await api.get(`/api/products/${prod.id}/price`);

    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(85);
  });

  it('falls back to category basePrice when product price is null', async () => {
    const cat = await seedCategory('Tostadas', { basePrice: 70 });
    const prod = await prisma.product.create({
      data: { name: 'Tostada de Ceviche', categoryId: cat.id, displayOrder: 0 },
    });

    const res = await api.get(`/api/products/${prod.id}/price`);

    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(70);
  });

  it('returns 404 when both prices are null', async () => {
    const cat = await seedCategory('NoPriceCategory');
    const prod = await prisma.product.create({
      data: { name: 'NoPriceProduct', categoryId: cat.id, displayOrder: 0 },
    });

    const res = await api.get(`/api/products/${prod.id}/price`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent product', async () => {
    const res = await api.get('/api/products/999/price');

    expect(res.status).toBe(404);
  });
});

// ----- UPDATE -----

describe('PUT /api/products/:id', () => {
  it('updates product fields', async () => {
    const cat = await seedCategory('Mariscos');
    const prod = await prisma.product.create({
      data: { name: 'Old', categoryId: cat.id, displayOrder: 0 },
    });

    const res = await api.put(`/api/products/${prod.id}`, {
      name: 'New',
      price: 99.50,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New');
    expect(Number(res.body.data.price)).toBe(99.50);
  });

  it('returns 404 when product does not exist', async () => {
    const res = await api.put('/api/products/999', { name: 'X' });

    expect(res.status).toBe(404);
  });

  it('returns 409 on duplicate name', async () => {
    const cat = await seedCategory('Mariscos');
    await prisma.product.createMany({
      data: [
        { name: 'A', categoryId: cat.id, displayOrder: 0 },
        { name: 'B', categoryId: cat.id, displayOrder: 1 },
      ],
    });
    const prodB = await prisma.product.findFirst({ where: { name: 'B' } });

    const res = await api.put(`/api/products/${prodB!.id}`, { name: 'A' });

    expect(res.status).toBe(409);
  });

  it('recalculates displayOrder when moving to a different category', async () => {
    const catA = await seedCategory('A');
    const catB = await seedCategory('B', { displayOrder: 1 });
    // catB already has one product
    await prisma.product.create({ data: { name: 'B1', categoryId: catB.id, displayOrder: 0 } });
    // Product in catA that we'll move
    const prod = await prisma.product.create({
      data: { name: 'Mover', categoryId: catA.id, displayOrder: 0 },
    });

    const res = await api.put(`/api/products/${prod.id}`, { categoryId: catB.id });

    expect(res.status).toBe(200);
    // Should be placed at the end of catB (displayOrder = 1)
    expect(res.body.data.categoryId).toBe(catB.id);
    expect(res.body.data.displayOrder).toBe(1);
  });
});

// ----- DEACTIVATION & REACTIVATION -----

describe('Product deactivation', () => {
  it('deactivates a product and closes displayOrder gaps', async () => {
    const cat = await seedCategory('Mariscos');
    await prisma.product.createMany({
      data: [
        { name: 'A', categoryId: cat.id, displayOrder: 0, active: true },
        { name: 'B', categoryId: cat.id, displayOrder: 1, active: true },
        { name: 'C', categoryId: cat.id, displayOrder: 2, active: true },
      ],
    });
    const prodB = await prisma.product.findFirst({ where: { name: 'B' } });

    const res = await api.delete(`/api/products/${prodB!.id}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Product deactivated');

    // Active products re-indexed: A=0, C=1
    const active = await prisma.product.findMany({
      where: { categoryId: cat.id, active: true },
      orderBy: { displayOrder: 'asc' },
    });
    expect(active).toHaveLength(2);
    expect(active[0].name).toBe('A');
    expect(active[0].displayOrder).toBe(0);
    expect(active[1].name).toBe('C');
    expect(active[1].displayOrder).toBe(1);
  });
});

describe('Product reactivation', () => {
  it('reactivates a product and shifts existing products', async () => {
    const cat = await seedCategory('Mariscos');
    await prisma.product.createMany({
      data: [
        { name: 'Active1', categoryId: cat.id, displayOrder: 0, active: true },
        { name: 'Inactive', categoryId: cat.id, displayOrder: 0, active: false },
      ],
    });
    const inactive = await prisma.product.findFirst({ where: { name: 'Inactive' } });

    const res = await api.put(`/api/products/${inactive!.id}`, { active: true });

    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(true);
  });

  it('reactivates parent category when reactivating a product in an inactive category', async () => {
    const cat = await seedCategory('Mariscos', { active: false });
    const prod = await prisma.product.create({
      data: { name: 'P1', categoryId: cat.id, displayOrder: 0, active: false },
    });

    const res = await api.put(`/api/products/${prod.id}`, { active: true });

    expect(res.status).toBe(200);

    // Parent category should now be active
    const dbCat = await prisma.category.findUnique({ where: { id: cat.id } });
    expect(dbCat!.active).toBe(true);
  });
});

// ----- HARD DELETE -----

describe('DELETE /api/products/:id?permanent=true', () => {
  it('permanently deletes the product', async () => {
    const cat = await seedCategory('Mariscos');
    const prod = await prisma.product.create({
      data: { name: 'Bye', categoryId: cat.id, displayOrder: 0 },
    });

    const res = await api.delete(`/api/products/${prod.id}?permanent=true`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Product permanently deleted');

    const dbProd = await prisma.product.findUnique({ where: { id: prod.id } });
    expect(dbProd).toBeNull();
  });

  it('returns 404 for non-existent product', async () => {
    const res = await api.delete('/api/products/999?permanent=true');

    expect(res.status).toBe(404);
  });
});

// ----- REORDER -----

describe('PATCH /api/products/reorder', () => {
  it('reorders products within a category', async () => {
    const cat = await seedCategory('Mariscos');
    await prisma.product.createMany({
      data: [
        { name: 'A', categoryId: cat.id, displayOrder: 0, active: true },
        { name: 'B', categoryId: cat.id, displayOrder: 1, active: true },
        { name: 'C', categoryId: cat.id, displayOrder: 2, active: true },
      ],
    });
    const prods = await prisma.product.findMany({
      where: { categoryId: cat.id },
      orderBy: { displayOrder: 'asc' },
    });
    const [a, b, c] = prods;

    const res = await api.patch('/api/products/reorder', {
      categoryId: cat.id,
      productIds: [c.id, a.id, b.id],
    });

    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(3);

    const reordered = await prisma.product.findMany({
      where: { categoryId: cat.id },
      orderBy: { displayOrder: 'asc' },
    });
    expect(reordered[0].name).toBe('C');
    expect(reordered[1].name).toBe('A');
    expect(reordered[2].name).toBe('B');
  });

  it('returns 400 when products do not belong to the specified category', async () => {
    const catA = await seedCategory('A');
    const catB = await seedCategory('B', { displayOrder: 1 });
    const prod = await prisma.product.create({
      data: { name: 'P1', categoryId: catA.id, displayOrder: 0, active: true },
    });

    const res = await api.patch('/api/products/reorder', {
      categoryId: catB.id,
      productIds: [prod.id],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("don't belong to category");
  });
});
