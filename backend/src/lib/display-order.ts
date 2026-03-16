import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

type TransactionClient = Prisma.TransactionClient;

/**
 * Re-indexes displayOrder for all active items matching the filter,
 * closing any gaps left after deactivation, deletion, or category moves.
 */
export async function closeDisplayOrderGaps(
  tx: TransactionClient,
  model: 'category' | 'product',
  filter: Record<string, unknown> = {}
): Promise<void> {
  const delegate = tx[model] as any;
  const items: { id: number }[] = await delegate.findMany({
    where: { active: true, ...filter },
    orderBy: { displayOrder: 'asc' },
    select: { id: true },
  });

  await Promise.all(
    items.map((item, index) =>
      delegate.update({ where: { id: item.id }, data: { displayOrder: index } })
    )
  );
}

/**
 * Validates and atomically reorders items by setting displayOrder = array index.
 * Checks for existence, scope membership, and duplicates before applying.
 */
export async function reorderDisplayOrder(
  model: 'category' | 'product',
  ids: number[],
  filter: Record<string, unknown> = {}
): Promise<number> {
  const delegate = (prisma as any)[model];

  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    throw new Error(`Duplicate ${model} IDs in reorder request`);
  }

  const found: { id: number }[] = await delegate.findMany({
    where: { id: { in: ids }, active: true, ...filter },
    select: { id: true },
  });

  if (found.length !== ids.length) {
    const foundIds = found.map((item: { id: number }) => item.id);
    const missingIds = ids.filter(id => !foundIds.includes(id));
    const filterDesc = 'categoryId' in filter
      ? ` or products don't belong to category ${filter.categoryId}`
      : '';
    throw new Error(`Invalid ${model} IDs: ${missingIds.join(', ')}${filterDesc}`);
  }

  const updateOperations = ids.map((id, index) =>
    delegate.update({
      where: { id },
      data: { displayOrder: index },
    })
  );

  await prisma.$transaction(updateOperations);

  return ids.length;
}
