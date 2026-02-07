import { defineConfig } from '@prisma/client';

export default defineConfig({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://localhost:5432/meppos'
    }
  }
});
