import { describe, it, expect, vi, beforeEach } from 'vitest';
import { closeDisplayOrderGaps, reorderDisplayOrder } from '../../../src/lib/display-order';

// Mock the prisma module — replaces the real import inside display-order.ts
// so reorderDisplayOrder uses our fake instead of a real DB connection.
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    category: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Import the mocked prisma so we can control its behavior in each test
import { prisma } from '../../../src/lib/prisma';

describe('closeDisplayOrderGaps', () => {
  // For this function we create a fake transaction client (tx) directly,
  // since it receives it as a parameter — no need to use the module mock.
  let mockFindMany: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;
  let fakeTx: any;

  beforeEach(() => {
    mockFindMany = vi.fn();
    mockUpdate = vi.fn().mockResolvedValue({});
    fakeTx = {
      category: { findMany: mockFindMany, update: mockUpdate },
      product: { findMany: mockFindMany, update: mockUpdate },
    };
  });

  it('re-indexes items sequentially starting from 0', async () => {
    // Simulate items with gaps: displayOrder 0, 3, 7
    mockFindMany.mockResolvedValue([
      { id: 10 },
      { id: 20 },
      { id: 30 },
    ]);

    await closeDisplayOrderGaps(fakeTx, 'category');

    // Should assign 0, 1, 2 based on array position
    expect(mockUpdate).toHaveBeenCalledTimes(3);
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 10 }, data: { displayOrder: 0 } });
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 20 }, data: { displayOrder: 1 } });
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 30 }, data: { displayOrder: 2 } });
  });

  it('queries only active items with the given filter', async () => {
    mockFindMany.mockResolvedValue([]);

    await closeDisplayOrderGaps(fakeTx, 'product', { categoryId: 5 });

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { active: true, categoryId: 5 },
      orderBy: { displayOrder: 'asc' },
      select: { id: true },
    });
  });

  it('does nothing when there are no active items', async () => {
    mockFindMany.mockResolvedValue([]);

    await closeDisplayOrderGaps(fakeTx, 'category');

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('works with the product model', async () => {
    mockFindMany.mockResolvedValue([{ id: 1 }]);

    await closeDisplayOrderGaps(fakeTx, 'product');

    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { displayOrder: 0 } });
  });
});

describe('reorderDisplayOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws on duplicate IDs', async () => {
    await expect(
      reorderDisplayOrder('category', [1, 2, 1])
    ).rejects.toThrow('Duplicate category IDs in reorder request');
  });

  it('throws when some IDs are not found (missing or inactive)', async () => {
    // Only ID 1 exists, but we requested [1, 2, 3]
    vi.mocked(prisma.category.findMany).mockResolvedValue([{ id: 1 }] as any);

    await expect(
      reorderDisplayOrder('category', [1, 2, 3])
    ).rejects.toThrow('Invalid category IDs: 2, 3');
  });

  it('includes category hint in error when filter has categoryId', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([{ id: 1 }] as any);

    await expect(
      reorderDisplayOrder('product', [1, 99], { categoryId: 5 })
    ).rejects.toThrow("don't belong to category 5");
  });

  it('updates displayOrder for each ID and wraps in a transaction', async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValue([
      { id: 3 }, { id: 1 }, { id: 2 },
    ] as any);
    vi.mocked(prisma.category.update).mockResolvedValue({} as any);
    vi.mocked(prisma.$transaction).mockResolvedValue([]);

    const count = await reorderDisplayOrder('category', [3, 1, 2]);

    expect(count).toBe(3);
    // Verify update was called for each ID with its new index
    expect(prisma.category.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { displayOrder: 0 } });
    expect(prisma.category.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { displayOrder: 1 } });
    expect(prisma.category.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { displayOrder: 2 } });
    // Verify all updates were wrapped in $transaction
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('passes filter to findMany for scope validation', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: 10 }, { id: 20 },
    ] as any);
    vi.mocked(prisma.product.update).mockResolvedValue({} as any);
    vi.mocked(prisma.$transaction).mockResolvedValue([]);

    await reorderDisplayOrder('product', [10, 20], { categoryId: 5 });

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: [10, 20] }, active: true, categoryId: 5 },
      select: { id: true },
    });
  });
});
