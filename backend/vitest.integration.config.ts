import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration-db/**/*.test.ts'],
    globalSetup: ['tests/integration-db/globalSetup.ts'],
    setupFiles: ['tests/integration-db/setup.ts'],
    // Longer timeout — real DB operations are slower than mocked ones
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
