# MEPPOS - Seafood Restaurant POS System

Point of Sale (POS) system for seafood restaurants, built with Angular and Node.js.

## 🏗️ Project Structure (Mono-repo)

```bash
MEPPOS/
├── frontend/          # Angular Application
├── backend/           # REST API with Node.js + Express
├── docker-compose.yml # Containerized PostgreSQL
└── .claude/commands/  # Technical specifications and reference docs
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
npm run dev              # Development with hot-reload
npm run build            # Compile to JavaScript
npm start                # Run compiled version
npm run prisma:migrate   # Create/apply migrations
npm run prisma:studio    # Open Prisma Studio (DB GUI)
npm run prisma:seed      # Seed database with sample data
npm run db:reset         # Reset database (deletes everything)
```

### Frontend (`/frontend`)

```bash
npm start            # Development server
npm run build        # Production build
npm test             # Run tests
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
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/meppos_db"
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:4200
```

---

## 📚 API Documentation

### Main Endpoints

#### Menu (for calculator)

- `GET /api/menu` - Full menu: active categories with active products and resolved `price`

#### Categories

- `GET /api/categories` - List all categories (supports `?active=true`)
- `GET /api/categories/:id` - Get a category with its products
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Soft delete (deactivate) category and products. Hard delete with `?permanent=true`
- `PATCH /api/categories/reorder` - Batch reorder categories (atomic transaction)

#### Products

- `GET /api/products` - List all products with raw `price` + `categories` array (supports `?active=true`)
- `GET /api/products/:id` - Get a product by ID
- `GET /api/products/:id/price` - Get effective price (direct or inherited from category)
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Soft delete (deactivate) product. Hard delete with `?permanent=true`
- `PATCH /api/products/reorder` - Batch reorder products within a category (atomic transaction)
- `GET /api/categories/:categoryId/products` - List products by category

#### Health Check

- `GET /health` - Check server status
- `GET /api` - Endpoint documentation

> **Note:** In `GET /api/menu`, `price` is resolved: `product.price ?? category.base_price`. In `GET /api/products`, `price` is the raw product value (may be `null`) and the response includes a `categories` array so the client can resolve inherited prices.

---

## 🛠️ Tech Stack

### Frontend

- Angular 21.1.3
- TypeScript 5.9.3
- Tailwind CSS 4.1.18
- DaisyUI 5.5.18
- Vitest 4.0.18
- RxJS 7.8.2

### Backend

- Node.js 18+
- Express.js 5.2.1
- TypeScript 5.9.3
- Prisma ORM 7.3.0
- Zod 4.3.6 (validation)
- PostgreSQL 15+ (pg 8.18.0 + @prisma/adapter-pg)

### Data Model

The system uses 2 tables:

1. **categories** - Product categories with optional base price
2. **products** - Individual products that can inherit price from their category or define their own

---

## 📖 Project Phases

### 🔧 Phase 1 (In Progress) - Bill Calculator

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
- ✅ Bill page (stub)
- ✅ Shared icon component
- 🔜 Bill calculator interface

### Future Phases

- Phase 2: Bill persistence, sales history, reports, authentication
- Phase 3: Multi-terminal, table assignment, ticket printing
- Phase 4: Payment integrations, analytics dashboard, online ordering

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

### Backend Folder Structure

```bash
backend/src/
├── controllers/       # HTTP handlers
├── services/         # Business logic
├── types/            # TypeScript types
├── routes/           # Route configuration
└── index.ts          # Main server
```

### Frontend Folder Structure

```bash
frontend/src/
├── app/              # Root component, routes, config
├── core/
│   ├── models/       # TypeScript interfaces
│   └── services/     # Angular services (HTTP, theme, toast, confirm dialog, category, product)
├── environments/     # Environment configs (dev/prod)
├── pages/            # Page components (menu, bill, settings)
│   └── settings/components/  # Settings sub-components (theme-selector, category-manager, product-manager)
└── shared/components/        # Reusable UI components (toast, confirm-dialog, icon)
```
