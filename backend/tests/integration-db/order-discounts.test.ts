import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, prisma } from './helpers/db';

async function seedUser() {
  return prisma.user.create({
    data: { username: 'waiter', password: 'placeholder', displayName: 'Waiter', role: 'WAITER' },
  });
}

async function seedOrder() {
  const user = await seedUser();
  return prisma.order.create({
    data: { takeoutNumber: 1, ownerUserId: user.id },
  });
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('order_discounts DB constraints', () => {
  it.each([
    { description: 'fixed', type: 'fixed', value: 50, amount: 50 },
    { description: 'percentage', type: 'percentage', value: 10, amount: 17.5 },
    { description: 'percentage at cap', type: 'percentage', value: 100, amount: 175 },
    { description: 'fixed above 100', type: 'fixed', value: 150, amount: 150 },
    { description: 'percentage rounds to zero', type: 'percentage', value: 5, amount: 0 },
  ])('accepts $description', async ({ type, value, amount }) => {
    const order = await seedOrder();

    const discount = await prisma.orderDiscount.create({
      data: { orderId: order.id, description: type, type: type as 'fixed' | 'percentage', value, amount },
    });

    expect(discount.id).toBeDefined();
  });

  it.each([
    { description: 'percentage over 100', type: 'percentage', value: 101, amount: 100, constraint: 'order_discounts_percentage_range_check' },
    { description: 'zero value', type: 'fixed', value: 0, amount: 0, constraint: 'order_discounts_value_check' },
    { description: 'negative value', type: 'fixed', value: -50, amount: 0, constraint: 'order_discounts_value_check' },
    { description: 'negative amount', type: 'fixed', value: 30, amount: -30, constraint: 'order_discounts_amount_check' },
  ])('rejects $description', async ({ type, value, amount, constraint }) => {
    const order = await seedOrder();

    await expect(
      prisma.orderDiscount.create({
        data: { orderId: order.id, description: type, type: type as 'fixed' | 'percentage', value, amount },
      }),
    ).rejects.toThrow(new RegExp(constraint));
  });
});
