import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

// Validate DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create PostgreSQL connection pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Create and export Prisma client instance
export const prisma = new PrismaClient({ adapter });

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  await pool.end();
});
