import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { resetDb, prisma } from './helpers/db';

// No auth tokens needed — GET /api/menu is a public endpoint

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Seed helper: creates a category with sensible defaults
async function seedCategory(
  name: string,
  overrides: Record<string, unknown> = {},
) {
  return prisma.category.create({
    data: { name, displayOrder: 0, ...overrides },
  });
}

// ----- FILTERING -----

describe('GET /api/menu — filtering', () => {
  it('returns only active categories', async () => {
    await prisma.category.createMany({
      data: [
        { name: 'Active Cat', displayOrder: 0, active: true },
        { name: 'Inactive Cat', displayOrder: 1, active: false },
      ],
    });

    const res = await request(app).get('/api/menu');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].name).toBe('Active Cat');
  });

  it('returns only active products within active categories', async () => {
    const cat = await seedCategory('Mariscos');
    await prisma.product.createMany({
      data: [
        { name: 'Active Prod', categoryId: cat.id, displayOrder: 0, active: true },
        { name: 'Inactive Prod', categoryId: cat.id, displayOrder: 1, active: false },
      ],
    });

    const res = await request(app).get('/api/menu');

    expect(res.body.data[0].products).toHaveLength(1);
    expect(res.body.data[0].products[0].name).toBe('Active Prod');
  });

  it('excludes products of inactive categories entirely', async () => {
    const inactiveCat = await seedCategory('Hidden', { active: false });
    await prisma.product.create({
      data: { name: 'Ghost', categoryId: inactiveCat.id, displayOrder: 0, active: true },
    });

    const res = await request(app).get('/api/menu');

    expect(res.body.count).toBe(0);
    expect(res.body.data).toEqual([]);
  });
});

// ----- ORDERING -----

describe('GET /api/menu — ordering', () => {
  it('returns categories sorted by displayOrder', async () => {
    await prisma.category.createMany({
      data: [
        { name: 'Second', displayOrder: 1, active: true },
        { name: 'First', displayOrder: 0, active: true },
        { name: 'Third', displayOrder: 2, active: true },
      ],
    });

    const res = await request(app).get('/api/menu');

    const names = res.body.data.map((c: any) => c.name);
    expect(names).toEqual(['First', 'Second', 'Third']);
  });

  it('returns products sorted by displayOrder within each category', async () => {
    const cat = await seedCategory('Mariscos');
    await prisma.product.createMany({
      data: [
        { name: 'C', categoryId: cat.id, displayOrder: 2, active: true },
        { name: 'A', categoryId: cat.id, displayOrder: 0, active: true },
        { name: 'B', categoryId: cat.id, displayOrder: 1, active: true },
      ],
    });

    const res = await request(app).get('/api/menu');

    const productNames = res.body.data[0].products.map((p: any) => p.name);
    expect(productNames).toEqual(['A', 'B', 'C']);
  });
});

// ----- PRICE RESOLUTION -----

describe('GET /api/menu — price resolution', () => {
  it('uses product price when set', async () => {
    const cat = await seedCategory('Mariscos', { basePrice: 70 });
    await prisma.product.create({
      data: { name: 'Camarón', categoryId: cat.id, price: 85, displayOrder: 0 },
    });

    const res = await request(app).get('/api/menu');

    expect(res.body.data[0].products[0].price).toBe(85);
  });

  it('falls back to category basePrice when product price is null', async () => {
    const cat = await seedCategory('Tostadas', { basePrice: 70 });
    await prisma.product.create({
      data: { name: 'Tostada de Ceviche', categoryId: cat.id, displayOrder: 0 },
    });

    const res = await request(app).get('/api/menu');

    expect(res.body.data[0].products[0].price).toBe(70);
  });

  it('returns null when both product and category prices are null', async () => {
    const cat = await seedCategory('NoPriceCat');
    await prisma.product.create({
      data: { name: 'NoPriceProd', categoryId: cat.id, displayOrder: 0 },
    });

    const res = await request(app).get('/api/menu');

    expect(res.body.data[0].products[0].price).toBeNull();
  });

  it('returns prices as plain numbers, not Prisma Decimal strings', async () => {
    const cat = await seedCategory('Mariscos', { basePrice: 70.5 });
    await prisma.product.create({
      data: { name: 'Camarón', categoryId: cat.id, price: 85.25, displayOrder: 0 },
    });

    const res = await request(app).get('/api/menu');

    const product = res.body.data[0].products[0];
    const category = res.body.data[0];
    expect(typeof product.price).toBe('number');
    expect(typeof category.basePrice).toBe('number');
  });
});

// ----- RESPONSE SHAPE -----

describe('GET /api/menu — response shape', () => {
  it('has the expected top-level structure', async () => {
    const res = await request(app).get('/api/menu');

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('category shape matches frontend expectations', async () => {
    const cat = await seedCategory('Mariscos', {
      description: 'Seafood dishes',
      basePrice: 70,
      image: 'mariscos.jpg',
    });
    await prisma.product.create({
      data: { name: 'Camarón', categoryId: cat.id, displayOrder: 0 },
    });

    const res = await request(app).get('/api/menu');

    const category = res.body.data[0];
    expect(category).toEqual({
      id: expect.any(Number),
      name: 'Mariscos',
      description: 'Seafood dishes',
      basePrice: 70,
      image: 'mariscos.jpg',
      displayOrder: 0,
      products: expect.any(Array),
    });

    // Should NOT contain raw DB fields
    expect(category).not.toHaveProperty('active');
    expect(category).not.toHaveProperty('createdAt');
    expect(category).not.toHaveProperty('updatedAt');
    expect(category).not.toHaveProperty('_count');
  });

  it('product shape matches frontend expectations', async () => {
    const cat = await seedCategory('Mariscos', { basePrice: 70 });
    await prisma.product.create({
      data: {
        name: 'Camarón',
        categoryId: cat.id,
        description: 'Shrimp dish',
        price: 85,
        image: 'camaron.jpg',
        displayOrder: 0,
        customizable: true,
      },
    });

    const res = await request(app).get('/api/menu');

    const product = res.body.data[0].products[0];
    expect(product).toEqual({
      id: expect.any(Number),
      name: 'Camarón',
      description: 'Shrimp dish',
      price: 85,
      image: 'camaron.jpg',
      displayOrder: 0,
      customizable: true,
    });

    // Should NOT contain raw DB fields
    expect(product).not.toHaveProperty('categoryId');
    expect(product).not.toHaveProperty('active');
    expect(product).not.toHaveProperty('createdAt');
    expect(product).not.toHaveProperty('updatedAt');
    expect(product).not.toHaveProperty('category');
  });
});

// ----- ACCESS -----

describe('GET /api/menu — public access', () => {
  it('does not require authentication', async () => {
    const res = await request(app).get('/api/menu');

    expect(res.status).toBe(200);
  });
});
