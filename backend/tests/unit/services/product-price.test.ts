import { describe, it, expect, vi, beforeEach } from 'vitest';
import { productService } from '../../../src/services/product.service';

// Mock prisma so the service doesn't hit a real database.
// getEffectivePrice internally calls getProductById, which uses prisma.product.findUnique.
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    product: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '../../../src/lib/prisma';

// Helper: builds a fake product matching the shape returned by getProductById
// (includes category relation). Uses plain numbers that behave like Prisma.Decimal
// since Number(n) === n.
function fakeProduct(price: number | null, basePrice: number | null) {
  return {
    id: 1,
    name: 'Test Product',
    price,
    category: { id: 10, name: 'Test Category', basePrice },
  };
}

describe('ProductService.getEffectivePrice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the product does not exist', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

    const result = await productService.getEffectivePrice(999);

    expect(result).toBeNull();
  });

  it('returns the product price when the product has its own price', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(fakeProduct(85, 70) as any);

    const result = await productService.getEffectivePrice(1);

    expect(result).toBe(85);
  });

  it('falls back to category basePrice when product price is null', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(fakeProduct(null, 70) as any);

    const result = await productService.getEffectivePrice(1);

    expect(result).toBe(70);
  });

  it('returns null when both product price and category basePrice are null', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(fakeProduct(null, null) as any);

    const result = await productService.getEffectivePrice(1);

    expect(result).toBeNull();
  });

  it('converts Decimal-like values to plain numbers', async () => {
    // Prisma.Decimal has a toString() that Number() can parse.
    // Simulate with an object that Number() coerces correctly.
    const decimalLike = { toString: () => '125.50' } as any;
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      id: 1,
      name: 'Decimal Product',
      price: decimalLike,
      category: { id: 10, name: 'Cat', basePrice: null },
    } as any);

    const result = await productService.getEffectivePrice(1);

    expect(result).toBe(125.50);
    expect(typeof result).toBe('number');
  });
});
