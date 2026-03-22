import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, prisma } from './helpers/db';

describe('Test DB smoke test', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects to the test database', async () => {
    const result = await prisma.$queryRaw<[{ v: number }]>`SELECT 1 AS v`;
    expect(result[0].v).toBe(1);
  });

  it('has the categories table (migrations applied)', async () => {
    const categories = await prisma.category.findMany();
    expect(categories).toEqual([]);
  });

  it('can create and read a record', async () => {
    await prisma.category.create({
      data: { name: 'Smoke Test Category', displayOrder: 0 },
    });

    const categories = await prisma.category.findMany();
    expect(categories).toHaveLength(1);
    expect(categories[0].name).toBe('Smoke Test Category');
  });

  it('resetDb clears all data between tests', async () => {
    // The previous test created a category, but resetDb in beforeEach cleared it
    const categories = await prisma.category.findMany();
    expect(categories).toEqual([]);
  });
});
