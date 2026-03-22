import dotenv from 'dotenv';
import path from 'node:path';

// Load .env.test BEFORE any source module (like prisma.ts) runs.
// prisma.ts does `import 'dotenv/config'` which loads .env, but since
// dotenv doesn't override existing vars by default, our test values win.
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });
