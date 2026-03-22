import { execSync } from 'node:child_process';
import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Runs once before all integration-db tests.
 *
 * 1. Loads .env.test so DATABASE_URL points to the test container.
 * 2. Generates the Prisma client (in case it's out of date).
 * 3. Applies all migrations to the test database.
 */
export async function setup() {
  dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

  const cwd = path.resolve(__dirname, '../..');

  console.log('\n[globalSetup] Applying migrations to test database…');

  execSync('npx prisma migrate deploy', {
    cwd,
    stdio: 'inherit',
    env: { ...process.env },
  });

  console.log('[globalSetup] Test database ready.\n');
}
