import { Prisma } from '@prisma/client';

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
