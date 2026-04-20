import { prisma } from '../../../src/lib/prisma';

/**
 * Truncates all tables and resets auto-increment sequences.
 * Call in beforeEach() so each test starts with a clean database.
 *
 * Uses CASCADE to handle foreign key constraints automatically
 * (e.g. products → categories).
 */
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "products", "categories", "users", "custom_extras", "locations" RESTART IDENTITY CASCADE',
  );
}

export { prisma };
