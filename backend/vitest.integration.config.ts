import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration-db/**/*.test.ts'],
    // Tests share a single database — run files sequentially to avoid race conditions
    fileParallelism: false,
    globalSetup: ['tests/integration-db/globalSetup.ts'],
    setupFiles: ['tests/integration-db/setup.ts'],
    // Longer timeout — real DB operations are slower than mocked ones
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
