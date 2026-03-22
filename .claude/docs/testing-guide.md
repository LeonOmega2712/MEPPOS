# MEPPOS Backend — Testing Study Guide

Guide covering the testing infrastructure, patterns, and reasoning behind each test suite in the MEPPOS backend. Written so you can explain how and why each piece works.

---

## 1. Infrastructure: Why the Code is Structured This Way

### 1.1 The `app.ts` / `index.ts` Separation

**Problem:** When using **supertest** for integration tests, you need to import the Express app **without starting the HTTP server**. If you import a file that calls `app.listen()`, every test spins up a real server on a port — causing port conflicts and slow tests.

**Solution:** Split into two files:

- **`src/app.ts`** — Configures and exports the Express app (middlewares, routes, error handlers). Does NOT call `listen()`.
- **`src/index.ts`** — Imports app from `app.ts`, calls `app.listen()`. This is the production/development entry point.

Tests import from `app.ts` directly:

```ts
import app from '../../src/app';
const res = await request(app).get('/health'); // No real server started
```

Supertest handles the HTTP layer internally — it creates a temporary server, sends the request, and tears it down. This is a **standard pattern** in Express projects with testing.

### 1.2 Vitest Configuration

There are **two separate Vitest configs** — one for unit/mocked tests and one for real-DB integration tests:

```ts
// vitest.config.ts — unit + mocked integration tests (no Docker needed)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration-db/**'],  // Real-DB tests excluded
  },
});
```

```ts
// vitest.integration.config.ts — real-DB integration tests (requires Docker)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration-db/**/*.test.ts'],
    globalSetup: ['tests/integration-db/globalSetup.ts'],
    setupFiles: ['tests/integration-db/setup.ts'],
    testTimeout: 15_000,   // Real DB ops are slower
    hookTimeout: 30_000,
  },
});
```

**Why two configs?** If the DB setup (globalSetup) were in the main config, `npm test` would fail without Docker running. Separating them means:

- `npm test` — fast, no external dependencies, runs anywhere
- `npm run test:integration` — requires Docker, tests against real PostgreSQL

Key options explained:

- **`environment: 'node'`** — Backend project, tests run in Node.js (not jsdom).
- **`globalSetup`** — Runs **once** before all tests in a separate process. Used to apply DB migrations.
- **`setupFiles`** — Runs **in each test worker** before test files are loaded. Used to load `.env.test`.

### 1.3 Excluding Tests from TypeScript Compilation

```jsonc
// tsconfig.json
"exclude": ["node_modules", "dist", "tests"]
```

The `tests/` folder is excluded from `tsc` compilation because test files import dev dependencies (vitest, supertest) that are not part of the production build. If included, `tsc` would try to resolve them in the production compilation paths and fail.

Tests are compiled separately by Vitest using its own TypeScript handling.

### 1.4 npm Scripts

```json
"test": "vitest run",                                        // Unit + mocked integration tests
"test:watch": "vitest",                                      // Same, in watch mode
"test:integration": "vitest run -c vitest.integration.config.ts",  // Real-DB tests
"test:db:up": "docker compose -f ../docker-compose.test.yml up -d --wait",  // Start test DB
"test:db:down": "docker compose -f ../docker-compose.test.yml down"         // Stop test DB
```

- `vitest run` exits after running all tests — useful for CI pipelines.
- `vitest` (without `run`) stays alive and re-runs tests when you save files — useful during development.
- `test:db:up` starts the PostgreSQL test container and waits until the healthcheck passes.
- `test:integration` runs **only** the real-DB tests using the separate Vitest config.

### 1.5 Test Database Infrastructure (Docker)

Real-DB integration tests run against a dedicated PostgreSQL container, completely separate from the development database.

**`docker-compose.test.yml`** — Defines the test container:

- **Port 5433** (not 5432) to avoid conflicts with the dev database
- **`tmpfs`** instead of a persistent volume — data lives only in RAM, wiped when the container stops. This makes tests fast and ensures each run starts clean.
- Faster healthcheck interval (every 5s) for quicker startup

**`backend/.env.test`** — Connection string pointing to the test DB:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/meppos_test_db"
NODE_ENV=test
```

This file is committed (not in `.gitignore`) because it only contains local Docker credentials, not production secrets.

**`tests/integration-db/globalSetup.ts`** — Runs once before all tests:

1. Loads `.env.test` with `dotenv` so `DATABASE_URL` points to the test container
2. Runs `npx prisma migrate deploy` to apply all migrations to the test DB

`prisma migrate deploy` applies pending migrations **without creating new ones** — it's the "production" command that never prompts for confirmation, ideal for automated test setup.

**`tests/integration-db/setup.ts`** — Runs in each test worker:

```ts
dotenv.config({ path: '.env.test', override: true });
```

**Why is this needed in addition to globalSetup?** The `globalSetup` runs in a separate process — its env vars don't propagate to test workers. The `setupFiles` entry loads `.env.test` in each worker **before** any source code is imported. This is critical because `prisma.ts` does `import 'dotenv/config'` which would otherwise load `.env` (the dev DB). Since `dotenv` doesn't override existing vars by default, our test values win.

**`tests/integration-db/helpers/db.ts`** — Database reset helper:

```ts
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "products", "categories", "users" RESTART IDENTITY CASCADE',
  );
}
```

`TRUNCATE ... CASCADE RESTART IDENTITY` clears all rows and resets auto-increment IDs to 1. `CASCADE` handles foreign key constraints (e.g., products referencing categories). Call this in `beforeEach()` so each test starts with an empty database.

**Typical test file structure for real-DB tests:**

```ts
import { resetDb, prisma } from './helpers/db';

beforeEach(async () => {
  await resetDb();        // Clean slate for each test
});

afterAll(async () => {
  await prisma.$disconnect();  // Clean up DB connection
});
```

---

## 2. Key Testing Concepts

### 2.1 Unit Tests vs Integration Tests

| | Unit Tests | Integration Tests |
|---|---|---|
| **What they test** | A single function/module in isolation | Multiple layers working together through HTTP |
| **Dependencies** | Mocked (no DB, no network) | May use real or mocked dependencies |
| **Speed** | Very fast (< 1ms per test) | Slightly slower (HTTP overhead) |
| **Location** | `tests/unit/` | `tests/integration/` |

### 2.2 Mocking with Vitest

Mocking replaces real dependencies with controlled fakes so you can test logic in isolation without needing a database, network, or external service.

#### `vi.mock()` — Module-Level Mocking

Intercepts an `import` statement and replaces the entire module with a fake.

```ts
// Replace the real prisma import with a fake
vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));
```

**When to use:** When the function you're testing imports a dependency internally (like `prisma`), and you can't pass a fake through parameters.

#### Fake Parameters — Direct Injection

When a function receives its dependency as a parameter, you can pass a fake object directly — no need for `vi.mock()`.

```ts
// closeDisplayOrderGaps receives `tx` as a parameter
const fakeTx = {
  category: { findMany: vi.fn(), update: vi.fn() },
};
await closeDisplayOrderGaps(fakeTx, 'category');
```

**When to use:** When the function accepts the dependency as an argument. This is simpler and more explicit than module mocking.

#### `vi.fn()` — Creating Mock Functions

Creates a function that records its calls and can be programmed to return specific values.

```ts
const mockFn = vi.fn();
mockFn.mockResolvedValue([{ id: 1 }]); // Makes it return a Promise
```

#### `vi.mocked()` — TypeScript-Friendly Access

Wraps a mocked function so TypeScript recognizes mock methods like `.mockResolvedValue()`:

```ts
vi.mocked(prisma.product.findUnique).mockResolvedValue(null);
```

Without `vi.mocked()`, TypeScript would complain that `findUnique` doesn't have a `mockResolvedValue` method.

#### `vi.clearAllMocks()` vs `vi.resetAllMocks()`

- **`clearAllMocks()`** — Clears call history and return values. The mock function still exists.
- **`resetAllMocks()`** — Same as clear, but also removes any programmed behavior (`.mockResolvedValue()`, etc.).

Use `resetAllMocks()` in `beforeEach` when you want each test to start completely fresh.

### 2.3 Supertest

A library for testing HTTP endpoints without starting a real server.

```ts
import request from 'supertest';
import app from '../../src/app';

const res = await request(app)
  .post('/api/auth/login')              // HTTP method + path
  .set('Authorization', 'Bearer ...')   // Set headers
  .send({ username: 'admin' });         // Send JSON body

expect(res.status).toBe(200);
expect(res.body.data).toBeDefined();
```

**How it works:** Supertest creates a temporary HTTP server from your Express app, sends the request, captures the response, and tears down the server. No port conflicts, no network overhead.

### 2.4 Test Structure: `describe` / `it` / `expect`

```ts
describe('GroupName', () => {           // Groups related tests
  it('does something specific', () => { // A single test case
    expect(value).toBe(expected);       // An assertion
  });
});
```

- **`describe`** — Logical grouping. Can be nested (e.g., "valid credentials" inside "POST /api/auth/login").
- **`it`** — One specific behavior being tested. Name should read as a sentence: "it returns 401 when...".
- **`expect`** — The assertion. Common matchers: `toBe`, `toEqual`, `toBeNull`, `toHaveProperty`, `toThrow`, `toHaveBeenCalledWith`, `not.toHaveBeenCalled`.

---

## 3. Test Suite Breakdown

### 3.1 Error Utilities — `tests/unit/lib/error.test.ts`

**Source:** `src/lib/error.ts`

**What it tests:** Two type-guard functions used throughout controllers to identify specific error types from Prisma and Zod.

| Function | Purpose |
|---|---|
| `hasPrismaCode(error, code)` | Checks if an error has a specific Prisma error code (e.g., `P2002` for unique constraint violations) |
| `isZodError(error)` | Checks if an error is a Zod validation error |

**Why these matter:** Controllers catch errors from services and need to return different HTTP status codes depending on the error type. For example, `P2002` (duplicate) → 409 Conflict, `P2025` (not found) → 404.

**Testing approach:** Pure functions, no mocks needed. Tests pass various inputs (matching errors, non-matching errors, non-Error values like `null`, `string`, `number`) to verify the type guards handle all cases safely.

**Key technique — `Object.assign`:**

```ts
const err = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
```

Prisma errors are `Error` instances with an extra `code` property. `Object.assign` simulates this without needing to import Prisma's actual error classes.

### 3.2 Health Endpoint — `tests/integration/health.test.ts`

**Source:** `src/app.ts` (the `/health` route)

**What it tests:** The health check endpoint that monitoring tools and deployment platforms use to verify the API is running.

**Testing approach:** Pure integration test with supertest. No mocks — this endpoint has no dependencies (no DB, no auth). It just returns a JSON object with `status: 'ok'`, a timestamp, and the service name.

**Why it exists:** It's the simplest possible integration test. It validates that the app.ts extraction works, that supertest is configured correctly, and serves as a smoke test for the entire middleware chain (CORS, helmet, rate limiting, JSON parsing all run before this endpoint).

### 3.3 Auth Login Endpoint — `tests/integration/auth.test.ts`

**Source:** `src/controllers/auth.controller.ts` → `src/services/auth.service.ts`

**What it tests:** The `POST /api/auth/login` endpoint — the entry point for authentication.

**Testing approach:** Mocks `authService.login` at the module level so we don't need a database with real users. The focus is on the controller layer: does it validate input with Zod? Does it return the right status codes? Does it set the refresh token cookie?

**Test groups:**

| Group | What it verifies |
|---|---|
| Valid credentials | 200 response, accessToken in body, user data in body, refresh_token cookie set |
| Invalid credentials | 401 when service returns `null` |
| Validation errors | 400 when username/password/body is missing, service NOT called (Zod rejects before reaching the service) |

**Key insight — "service NOT called" assertions:**

```ts
expect(authService.login).not.toHaveBeenCalled();
```

This verifies that Zod validation runs **before** the service call. If validation fails, the service should never be invoked. This is important because it means invalid data never reaches the business logic layer.

**Cookie testing:**

```ts
const cookies: string[] = res.headers['set-cookie'] ?? [];
expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
```

HTTP cookies come back as an array of strings in the `set-cookie` header. We check that at least one starts with `refresh_token=`.

### 3.4 Display Order Utilities — `tests/unit/lib/display-order.test.ts`

**Source:** `src/lib/display-order.ts`

**What it tests:** The two most complex utility functions in the codebase — responsible for maintaining sequential ordering of categories and products.

#### `closeDisplayOrderGaps`

**What it does:** After deactivating or deleting an item, the displayOrder values might have gaps (e.g., 0, 3, 7 instead of 0, 1, 2). This function fetches all active items sorted by displayOrder and reassigns sequential indices starting from 0.

**Mocking approach:** This function receives `tx` (a Prisma transaction client) as a **parameter**, so we pass a **fake object** directly — no `vi.mock()` needed:

```ts
const fakeTx = {
  category: { findMany: mockFindMany, update: mockUpdate },
  product: { findMany: mockFindMany, update: mockUpdate },
};
```

| Test case | What it verifies |
|---|---|
| Re-indexes sequentially | Items get displayOrder 0, 1, 2 regardless of original values |
| Filter passing | The `where` clause includes `active: true` and any extra filter (e.g., `categoryId`) |
| Empty set | No updates are called when there are no active items |
| Model selection | Works with both `'category'` and `'product'` models |

#### `reorderDisplayOrder`

**What it does:** When the admin drags items to reorder, the frontend sends an array of IDs in the desired order. This function validates the request and atomically updates all displayOrder values.

**Mocking approach:** This function imports `prisma` internally, so we use **`vi.mock()`** to intercept the module:

```ts
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    category: { findMany: vi.fn(), update: vi.fn() },
    product: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
```

| Test case | What it verifies |
|---|---|
| Duplicate IDs | Throws `"Duplicate category IDs in reorder request"` |
| Missing/inactive IDs | Throws with the specific IDs that weren't found |
| Category scope hint | Error message includes category ID when filter has `categoryId` |
| Successful reorder | Each ID gets its array index as displayOrder, wrapped in `$transaction` |
| Filter forwarding | The `findMany` call includes the filter for scope validation |

### 3.5 JWT Utilities — `tests/unit/lib/jwt.test.ts`

**Source:** `src/lib/jwt.ts`

**What it tests:** Token generation and verification for both access tokens (short-lived, 15min) and refresh tokens (long-lived, 7 days).

**Testing approach:** Pure functions — no mocks needed. We generate tokens with the real functions and verify/decode them with the real functions. The `jsonwebtoken` library is used as-is, not mocked.

| Test case | What it verifies |
|---|---|
| JWT format | Token has 3 dot-separated parts (header.payload.signature) |
| Different tokens | Access and refresh tokens for the same payload are different (different secrets) |
| Payload decoding | `verifyAccessToken` returns the original `userId`, `username`, `role` |
| JWT claims | Decoded token includes `iat` (issued at) and `exp` (expiration) added by jsonwebtoken |
| Tampered token | Flipping the last character makes verification throw |
| **Cross-secret rejection** | A refresh token fails `verifyAccessToken` and vice versa |
| Invalid string | A non-JWT string makes verification throw |

**Security-critical test — cross-secret rejection:**

```ts
it('rejects a refresh token (different secret)', () => {
  const refreshToken = generateRefreshToken(samplePayload);
  expect(() => verifyAccessToken(refreshToken)).toThrow();
});
```

This is the most important test in this suite. Access and refresh tokens use **different secrets** (`JWT_ACCESS_SECRET` vs `JWT_REFRESH_SECRET`). If someone tries to use a refresh token as an access token (e.g., to bypass the 15min expiry), `verifyAccessToken` will reject it because the signature doesn't match. This test proves that the separation works.

### 3.6 Product Price Resolution — `tests/unit/services/product-price.test.ts`

**Source:** `src/services/product.service.ts` → `getEffectivePrice()`

**What it tests:** The core business rule for price resolution — how the system determines what price to show for a product.

**The three-level fallback:**

1. Product has its own `price` → use it
2. Product has no `price`, but its category has `basePrice` → inherit it
3. Neither has a price → return `null`

**Why this matters:** In the restaurant menu, many products within a category share the same price (e.g., all tostadas cost $70). Instead of setting the price on every product, you set `basePrice` on the category and only override on products with different prices.

**Mocking approach:** Mock `prisma.product.findUnique` since `getEffectivePrice` calls `getProductById` internally.

| Test case | What it verifies |
|---|---|
| Product not found | Returns `null` |
| Product has own price | Returns product price (ignores category basePrice) |
| Inherits from category | Returns category basePrice when product price is null |
| Both null | Returns `null` |
| Decimal conversion | Prisma.Decimal objects are converted to plain JavaScript numbers |

**Decimal conversion test:**

```ts
const decimalLike = { toString: () => '125.50' } as any;
```

Prisma stores monetary values as `Decimal` objects (for precision). When you call `Number(decimal)`, JavaScript calls `decimal.toString()` internally and parses the result. This test simulates that behavior with a fake object that has a `toString()` method returning a numeric string.

### 3.7 Auth Middleware — `tests/integration/auth-middleware.test.ts`

**Source:** `src/middleware/auth.middleware.ts`

**What it tests:** The two middleware functions that protect API routes:

- **`authenticate`** — Extracts and verifies the Bearer token from the Authorization header
- **`authorize(...roles)`** — Checks if the authenticated user has the required role

**Testing approach:** Integration tests through HTTP with supertest. We send real requests to actual routes and verify the middleware's response. The middleware itself is NOT mocked — we test it as a black box through the HTTP layer. Only Prisma is mocked (because the controllers behind the middleware would try to query the DB).

**Target routes:**

- `GET /api/auth/me` — Requires authentication (any role). Used to test `authenticate`.
- `GET /api/users` — Requires ADMIN role. Used to test `authorize`.

**Token generation:** Tests use the real `generateAccessToken`/`generateRefreshToken` functions to create valid tokens. For the expired token test, we use `jsonwebtoken` directly to sign a token with `expiresIn: '-1s'` (already expired).

#### `authenticate` tests

| Test case | What it verifies |
|---|---|
| No header | 401 — `"Access token required"` |
| Wrong prefix | 401 — `"Token xxx"` instead of `"Bearer xxx"` |
| Invalid token | 401 — `"Invalid or expired access token"` |
| Refresh as access | 401 — Refresh token rejected by `verifyAccessToken` (different secret) |
| Expired token | 401 — `"Invalid or expired access token"` |
| Valid token | 200 — Middleware passes, controller responds with user data |

#### `authorize` tests

| Test case | What it verifies |
|---|---|
| WAITER on admin route | 403 — `"Insufficient permissions"` |
| ADMIN on admin route | 200 — Both `authenticate` and `authorize` pass |

**Key insight:** The `authorize` tests also implicitly test `authenticate` — a request must pass authentication before reaching authorization. If the ADMIN test returns 200, it means both middleware layers worked correctly.

### 3.8 Category CRUD — `tests/integration-db/categories.test.ts`

**Source:** `src/controllers/category.controller.ts` → `src/services/category.service.ts`

**What it tests:** The complete category lifecycle through HTTP against a real PostgreSQL database — create, read, update, soft delete, hard delete, and reorder.

**Testing approach:** Full-stack integration — no mocks at all. Every request goes through the real middleware chain (auth → Zod validation → controller → service → Prisma → PostgreSQL). Uses real JWT tokens generated with `generateAccessToken` and data created directly via `prisma.create()`.

**API helper pattern:**

```ts
const api = {
  get: (path, token = adminToken) =>
    request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path, body, token = adminToken) =>
    request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  // ...
};
```

This reduces repetition — every request is authenticated by default with an admin token, and you can pass a different token (like `waiterToken`) when testing authorization.

#### POST /api/categories (Create)

| Test case | What it verifies |
|---|---|
| Auto displayOrder | First category gets `displayOrder: 0`, auto-increments for subsequent ones |
| Duplicate name | 409 — Prisma P2002 unique constraint detected |
| Missing name | 400 — Zod validation rejects before reaching the service |
| WAITER blocked | 403 — `authorize('ADMIN')` middleware rejects |

#### GET /api/categories (Read)

| Test case | What it verifies |
|---|---|
| All categories | Returns all (active + inactive) ordered by displayOrder |
| `?active=true` filter | Returns only active categories |
| Product count | Response includes `_count.products` |
| WAITER can read | GET routes are behind `authenticate` only, not `authorize` |
| No token | 401 — `authenticate` middleware rejects |

#### GET /api/categories/:id

| Test case | What it verifies |
|---|---|
| With products | Returns category with its nested products array |
| Non-existent ID | 404 |
| Invalid ID format | 400 — Zod coercion fails on `"abc"` |

#### PUT /api/categories/:id (Update)

| Test case | What it verifies |
|---|---|
| Update fields | 200 — name and description change |
| Non-existent | 404 — Prisma P2025 |
| Duplicate name | 409 — trying to rename to an existing name |

#### DELETE /api/categories/:id (Soft Delete)

| Test case | What it verifies |
|---|---|
| Cascade deactivation | Category AND its products set to `active: false` |
| Gap closing | After deactivating middle category, remaining active ones get re-indexed (0, 1) |
| Non-existent | 404 |

**Gap closing test in detail:** If categories A(0), B(1), C(2) exist and B is deactivated, `closeDisplayOrderGaps` re-indexes the active ones so A=0, C=1. The test verifies this by querying the DB directly after the DELETE request.

#### DELETE /api/categories/:id?permanent=true (Hard Delete)

| Test case | What it verifies |
|---|---|
| Permanent deletion | Category and products are completely removed from DB (Prisma `onDelete: Cascade` on the foreign key) |

#### PATCH /api/categories/reorder

| Test case | What it verifies |
|---|---|
| Atomic reorder | Categories get new displayOrder matching array index, verified by querying DB |
| Duplicate IDs | 400 — `"Duplicate category IDs"` |
| Non-existent IDs | 400 — `"Invalid category IDs: ..."` |

### 3.9 DB Smoke Test — `tests/integration-db/smoke.test.ts`

**What it tests:** Validates that the entire test DB infrastructure works — connection, migrations applied, CRUD operations, and that `resetDb()` clears data between tests.

This is a minimal sanity check that runs before the more complex integration tests. If this fails, the infrastructure setup has an issue.

---

## 4. Test File Summary

| File | Type | Tests | What it covers |
|---|---|---|---|
| `unit/lib/error.test.ts` | Unit | 7 | Prisma error code detection, Zod error detection |
| `unit/lib/display-order.test.ts` | Unit | 9 | Gap closure, atomic reordering, validation |
| `unit/lib/jwt.test.ts` | Unit | 9 | Token generation, verification, cross-secret rejection |
| `unit/services/product-price.test.ts` | Unit | 5 | Price fallback logic, Decimal conversion |
| `integration/health.test.ts` | Integration (mocked) | 2 | Health endpoint, supertest smoke test |
| `integration/auth.test.ts` | Integration (mocked) | 7 | Login endpoint, Zod validation, cookie setting |
| `integration/auth-middleware.test.ts` | Integration (mocked) | 8 | Authentication, authorization, token rejection |
| `integration-db/smoke.test.ts` | Integration (real DB) | 4 | DB connection, migrations, CRUD, resetDb |
| `integration-db/categories.test.ts` | Integration (real DB) | 23 | Full category CRUD lifecycle, auth guards |
| **Total** | | **73** | |

---

## 5. Quick Reference: When to Use Each Mocking Strategy

| Scenario | Strategy | Example |
|---|---|---|
| Function receives dependency as parameter | Fake parameter | `closeDisplayOrderGaps(fakeTx, ...)` |
| Function imports dependency internally | `vi.mock()` | Mocking `prisma` module |
| Pure function with no dependencies | No mocking | JWT functions, error utilities |
| Testing HTTP layer end-to-end | Supertest + mock only the DB | Auth middleware tests |

---

## 6. Running Tests

```bash
# --- Unit + mocked integration tests (no Docker needed) ---

npm test                                    # Run all once
npm run test:watch                          # Watch mode (re-runs on save)
npx vitest run tests/unit/lib/jwt.test.ts   # Run a specific file
npx vitest run --reporter=verbose           # Verbose output

# --- Real-DB integration tests (Docker required) ---

npm run test:db:up          # 1. Start test PostgreSQL container
npm run test:integration    # 2. Run real-DB tests
npm run test:db:down        # 3. Stop container when done
```

**Typical workflow:** Start Docker Desktop, run `test:db:up` once, then run `test:integration` as many times as needed. The container stays up between runs. Run `test:db:down` when you're done for the day.
