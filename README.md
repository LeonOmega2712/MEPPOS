# MEPPOS - Seafood Restaurant POS System

Point of Sale (POS) system for seafood restaurants, built with Angular and Node.js.

## 🏗️ Project Structure (Mono-repo)

```bash
MEPPOS/
├── frontend/          # Angular Application
├── backend/           # REST API with Node.js + Express
├── docker-compose.yml # Containerized PostgreSQL
├── .claude/docs/      # Reference documentation and phase specs
└── .claude/commands/  # Slash commands for Claude Code
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose (for PostgreSQL)
- npm

### 1. Setup and start the database

```bash
docker-compose up -d
```

### 2. Setup Backend

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Backend will be running at `http://localhost:3000`

### 3. Setup Frontend

```bash
cd frontend
npm install
npm start
```

Frontend will be running at `http://localhost:4200`

---

## 📦 Available Scripts

### Backend (`/backend`)

```bash
npm run dev                  # Development with hot-reload
npm run build                # Compile to JavaScript
npm start                    # Run compiled version
npm run prisma:migrate       # Create/apply migrations
npm run prisma:studio        # Open Prisma Studio (DB GUI)
npm run prisma:seed          # Seed database with sample data
npm run db:reset             # Reset database (deletes everything)
npm test                     # Run unit tests
npm run test:watch           # Run unit tests in watch mode
npm run test:coverage        # Run unit tests with coverage report
npm run test:db:up           # Start test PostgreSQL container
npm run test:integration     # Run integration tests (requires test DB)
npm run test:db:down         # Stop test PostgreSQL container
```

### Frontend (`/frontend`)

```bash
npm start                # Development server
npm run build            # Production build
npm test                 # Run unit tests (Vitest)
npm run e2e              # Run E2E tests headless (Playwright)
npm run e2e:ui           # Run E2E tests with Playwright UI
npm run e2e:headed       # Run E2E tests in headed browser
npm run e2e:report       # Show last E2E test report
```

---

## 🗄️ Database

### Prisma 7 Configuration

This project uses **Prisma ORM 7** with an adapter-based architecture:

- `prisma/prisma.config.ts`: Centralized configuration (uses `@prisma/config`)
- `prisma/schema.prisma`: Data model definition
- `DATABASE_URL` is managed in `prisma.config.ts` (not in `schema.prisma`)
- Uses PostgreSQL driver (`pg` + `@prisma/adapter-pg`)
- Run `npx prisma generate` manually after schema changes

### Direct connection to PostgreSQL

```bash
docker exec -it meppos-db psql -U postgres -d meppos_db
```

### Environment Variables (`backend/.env`)

```env
# Transaction pooler URL (port 6543) — used by the app at runtime
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/meppos_db"

# Direct connection URL (port 5432) — used by Prisma migrations only
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/meppos_db"

PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:4200

# Authentication (Phase 2)
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
ADMIN_DEFAULT_PASSWORD=admin123
```

---

## 📚 API Documentation

### Public Endpoints (no authentication required)

- `GET /api/menu` - Full menu: active categories with active products and resolved `price`
- `POST /api/auth/login` - Login (returns access token + httpOnly refresh cookie)
- `POST /api/auth/refresh` - Refresh access token (via httpOnly cookie)
- `POST /api/auth/logout` - Logout (clears refresh cookie)

### Authenticated Endpoints (any role)

- `GET /api/auth/me` - Get current user info
- `GET /api/categories` - List all categories (supports `?active=true`)
- `GET /api/categories/:id` - Get a category with its products
- `GET /api/categories/:categoryId/products` - List products by category
- `GET /api/products` - List all products with raw `price` + `categories` array (supports `?active=true`)
- `GET /api/products/:id` - Get a product by ID
- `GET /api/products/:id/price` - Get effective price (direct or inherited from category)
- `GET /api/locations` - List all locations (supports `?active=true`)
- `GET /api/extras` - List all active custom extras
- `POST /api/extras` - Create custom extra
- `PUT /api/extras/:id` - Update custom extra
- `DELETE /api/extras/:id` - Soft delete (deactivate) extra. Hard delete with `?permanent=true`

### Admin-only Endpoints

- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Soft delete (deactivate) category and products. Hard delete with `?permanent=true`
- `PATCH /api/categories/reorder` - Batch reorder categories (atomic transaction)
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Soft delete (deactivate) product. Hard delete with `?permanent=true`
- `PATCH /api/products/reorder` - Batch reorder products within a category (atomic transaction)
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Soft delete (deactivate) user
- `POST /api/locations` - Create location
- `PUT /api/locations/:id` - Update location
- `DELETE /api/locations/:id` - Soft delete (deactivate) location. Hard delete with `?permanent=true`
- `PATCH /api/locations/reorder` - Batch reorder locations (atomic transaction)

#### Health Check

- `GET /health` - Check server status
- `GET /api` - Endpoint documentation

> **Note:** In `GET /api/menu`, `price` is resolved: `product.price ?? category.base_price`. In `GET /api/products`, `price` is the raw product value (may be `null`) and the response includes a `categories` array so the client can resolve inherited prices.

---

## 🛠️ Tech Stack

### Frontend

- Angular ^21.0.0
- TypeScript ~5.9.2
- Tailwind CSS ^4.1.12
- DaisyUI ^5.5.14
- Angular CDK ^21.1.3
- Angular Service Worker ^21.1.3
- Vitest ^4.0.8
- Playwright (E2E testing)
- RxJS ~7.8.0

### Backend

- Node.js 18+
- Express.js 5.2.1
- TypeScript 5.9.3
- Prisma ORM 7.3.0
- Zod 4.3.6 (validation)
- PostgreSQL 15+ (pg 8.18.0 + @prisma/adapter-pg)
- bcryptjs (password hashing)
- jsonwebtoken (JWT authentication)
- helmet (security headers)
- express-rate-limit (API rate limiting)
- cookie-parser (refresh token cookies)

### Data Model

The system uses 5 tables:

1. **categories** - Product categories with optional base price
2. **products** - Individual products that can inherit price from their category or define their own
3. **users** - Staff accounts with roles (ADMIN, WAITER) for authentication
4. **custom_extras** - Reusable non-catalog items (extras) with a required default price, created by any authenticated user
5. **locations** - Physical restaurant locations: tables and bar (type enforced via DB CHECK constraint). Bar orders receive a system-assigned numeric identifier (daily consecutive) at order-creation time; no separate identifier table is required.

---

## 📖 Project Phases

### ✅ Phase 1 (Complete) - Bill Calculator

- ✅ Product catalog with flat categories
- ✅ Category-level base pricing with per-product overrides
- ✅ Customizable products (seafood selection)
- ✅ Complete REST API (CRUD for categories and products)
- ✅ Seed with real menu data
- ✅ Menu display (frontend)
- ✅ Theme selector with DaisyUI themes (localStorage persistence)
- ✅ Responsive navbar with app branding
- ✅ Category CRUD (frontend) with drag-and-drop reorder
- ✅ Product CRUD (frontend) with per-category drag-and-drop
- ✅ Settings page with tab-based UI (Categories/Products)
- ✅ Shared icon component
- ✅ Bill calculator interface (product grid by category — categories without products are hidden; DaisyUI collapse cards with integer-only quantity controls; expandable footer with scrollable item detail, sticky header/trash button, and real-time total; clicking a detail row scrolls to and highlights the product card)
- ✅ PWA compatibility (installable, service worker with asset caching, web app manifest, dynamic theme-color sync)
- ✅ Animated splash screen with branded entry animation and content-aware dismissal

### 🔧 Phase 2 (In Progress) - Bill Registration & Ticket Printing

- ✅ Security hardening (helmet, rate limiting, body size limit)
- ✅ User model with roles (ADMIN/WAITER) and Prisma migration
- ✅ JWT authentication (access token 15min + refresh token 7d httpOnly cookie)
- ✅ Auth middleware (authenticate + role-based authorize)
- ✅ Auth endpoints (login, refresh, logout, me)
- ✅ User CRUD (admin-only)
- ✅ Route protection (public / authenticated / admin-only)
- ✅ Frontend auth service, interceptor, guards
- ✅ Login page
- ✅ Conditional navbar (shown only when authenticated)
- ✅ Public menu route for digital/QR access
- ✅ Logout/user info in settings
- ✅ Backend unit tests (JWT utilities, display-order helpers, price resolution)
- ✅ Backend integration tests (categories, products, auth, users, public menu)
- ✅ Frontend E2E tests with Playwright (auth flows, bill calculator)
- ✅ Frontend unit tests with Vitest (interceptors, login page logic)
- ✅ GitHub Actions CI pipeline (backend + frontend unit + E2E jobs on every push)
- ✅ CD pipeline (auto-deploy to Koyeb + Vercel on push to master after CI passes)
- ✅ PWA auto-update: SwUpdate prompt with forced reload on new version
- ✅ Detailed login error messages with Koyeb cold start auto-retry (exponential backoff)
- ✅ SWR caching for settings tabs (categories, products, users, locations, extras) — instant tab switches, background revalidation, manual refresh
- ✅ Locations management (DB migrations, backend API, admin UI with drag-and-drop reorder)
- ✅ Custom extras management (DB migration, backend API, admin UI)
- ⬜ Persistent orders with multiple rounds
- ⬜ Discounts at checkout (fixed/percentage)
- ⬜ Account ownership and transfer between waiters
- ⬜ Kitchen ticket printing (per round)
- ⬜ Final ticket printing (consolidated)
- ⬜ Order history with reprint (marked as copy)

### Future Phases

- Phase 3: Order status tracking, centralized ordering, cashier terminal
- Phase 4: Reports, analytics dashboard, payment integrations

---

## 🐛 Troubleshooting

### Database won't connect

```bash
docker-compose ps
docker-compose logs postgres
docker-compose restart postgres
```

### Backend won't start

```bash
cd backend
cat .env
rm -rf node_modules package-lock.json
npm install
npm run prisma:generate
```

### Frontend won't connect to backend

- Verify backend is running on port 3000
- Check CORS configuration in `backend/src/index.ts`
- Check browser console for errors

### Migration errors

```bash
cd backend
npm run db:reset
npm run prisma:migrate
npm run prisma:seed
```

---

## 📝 Development Notes

### Code Conventions

- **Source code**: English (variables, functions, classes)
- **Documentation/Comments**: English
- **UI/User messages**: Spanish
- **Table names**: snake_case (e.g., `categories`, `products`)
- **TypeScript properties**: camelCase (e.g., `menuItems`)
- **Angular components**: PascalCase (e.g., `MenuPage`)

### Design Principles

- **SOLID**: Applied in backend architecture
- **DRY**: Don't repeat code
- **Separation of concerns**: Controllers → Services → DB
- **Validation**: Zod on all endpoints
- **Type Safety**: Strict TypeScript

### Testing Conventions

- **Frontend E2E (Playwright) runs without a backend.** The CI job only boots the Angular dev server — no Postgres, no API. Every `/api/*` call touched by an E2E test must be stubbed via `page.route(...)` in [`frontend/e2e/helpers/mocks.ts`](frontend/e2e/helpers/mocks.ts). When adding endpoints, extend that file with a `setupXxxMocks(page)` helper and compose it with `setupApiMocks(page)` in the test's `beforeEach`.
- **Full-stack coverage lives in backend integration tests**, not E2E: see `backend/tests/integration/` (mocked Prisma) and `backend/tests/integration-db/` (real Postgres via docker compose).

### Backend Folder Structure

```bash
backend/src/
├── controllers/       # HTTP handlers (auth, user, category, product, menu, location, custom-extra)
├── lib/              # Shared utilities (Prisma client, display-order helpers, JWT, error handling)
├── middleware/        # Express middleware (auth, authorize)
├── services/         # Business logic
├── types/            # Zod schemas and TypeScript types
├── routes/           # Route configuration (public, authenticated, admin)
└── index.ts          # Main server
```

### Frontend Folder Structure

```bash
frontend/src/
├── app/              # Root component, routes, config
├── core/
│   ├── guards/       # Route guards (auth, no-auth, unsaved changes)
│   ├── interceptors/ # HTTP interceptors (auth, server error handling with cold start retry)
│   ├── models/       # TypeScript interfaces
│   ├── services/     # Angular services (auth, user, category, product, menu, location, custom-extra, theme, toast, confirm dialog, splash, pwa-update)
│   └── utils/        # Utility classes (SWR cache)
├── environments/     # Environment configs (dev/prod)
├── pages/            # Page components (login, menu, bill, settings)
│   └── settings/components/  # Settings sub-components (theme-selector, category-manager, product-manager, user-manager, location-manager, custom-extra-manager)
└── shared/
    ├── components/            # Reusable UI components (toast, confirm-dialog, icon)
    └── styles/                # Shared component styles (CDK drag-drop, input resets)
```
