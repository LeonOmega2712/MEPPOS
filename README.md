# MEPPOS - Seafood Restaurant POS System

Point of Sale (POS) system for seafood restaurants, built with Angular and Node.js.

## 🏗️ Project Structure (Mono-repo)

```bash
MEPPOS/
├── frontend/          # Angular Application
├── backend/           # REST API with Node.js + Express
├── docker-compose.yml # Containerized PostgreSQL
└── README.md          # This file
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose (for PostgreSQL)
- npm or pnpm

### 1. Clone the repository

```bash
git clone <repo-url>
cd MEPPOS
```

### 2. Setup and start the database

```bash
# Start PostgreSQL with Docker
docker-compose up -d

# Verify it's running
docker-compose ps
```

### 3. Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Generate Prisma Client (Prisma 7 automatically generates on install)
npx prisma generate

# Run migrations
npm run prisma:migrate

# Seed database with sample data
npm run prisma:seed

# Start development server
npm run dev
```

Backend will be running at `http://localhost:3000`

### 4. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
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
npm run db:reset         # ⚠️ Reset database (deletes everything)
```

### Frontend (`/frontend`)

```bash
npm start            # Development server
npm run build        # Production build
npm test             # Run tests
```

---

## 🗄️ Database

### Management with Prisma

```bash
# View data in web interface
cd backend
npm run prisma:studio

# Create new migration
npm run prisma:migrate

# Reset database (careful in production!)
npm run db:reset
```

### Prisma 7 Configuration

This project uses **Prisma ORM 7**, which introduces a new configuration architecture:

**Key Files:**

- `prisma.config.ts` (root): Centralized configuration file
- `prisma/schema.prisma`: Data model definition (no URL connection)
- Database URL is configured via environment variables and adapters

**Important Notes:**

- Prisma 7 uses an **adapter-based architecture** with PostgreSQL driver (`pg` + `@prisma/adapter-pg`)
- The `DATABASE_URL` is now managed in `prisma.config.ts` instead of `schema.prisma`
- Run `npx prisma generate` manually after schema changes (auto-generation is disabled in Prisma 7)

### Direct connection to PostgreSQL

```bash
# Using psql
docker exec -it meppos-db psql -U postgres -d meppos_db

# Using any PostgreSQL client
Host: localhost
Port: 5432
Database: meppos_db
User: postgres
Password: postgres
```

---

## 🔧 Configuration

### Environment Variables

**Backend** (`backend/.env`):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/meppos_db"
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:4200
```

---

## 📚 API Documentation

### Main Endpoints

#### Categories

- `GET /api/categories` - List all categories
- `GET /api/categories/:id` - Get a category
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

#### Products

- `GET /api/products` - List all products
- `GET /api/products/:id` - Get a product
- `GET /api/products/:id/price` - Get product price (direct or inherited from category)
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/categories/:categoryId/products` - List products by category

### Health Check

- `GET /health` - Check server status
- `GET /api` - Endpoint documentation

---

## 🛠️ Tech Stack

### Frontend

- Angular 21.1
- TypeScript 5.9
- Tailwind CSS v4.1
- DaisyUI 5.5

### Backend

- Node.js 18+
- Express.js 5.2
- TypeScript 5.9
- Prisma ORM 7.2
- Zod 4.3 (validation)
- PostgreSQL driver (pg + @prisma/adapter-pg)

### Database

- PostgreSQL 15+

### Data Model

The system uses 2 tables:

1. **categories** - Product categories with optional base price
2. **products** - Individual products that can inherit price from their category or define their own

---

## 📖 Project Phases

### ✅ Phase 1 (Completed) - Menu System

- ✅ Product catalog with flat categories
- ✅ Category-level base pricing with per-product overrides
- ✅ Customizable products (seafood selection)
- ✅ Complete REST API (CRUD for categories and products)
- ✅ Seed with real menu data

### 🔜 Phase 2 - Calculator and Bill Persistence

- Calculator interface (frontend)
- Bills/sales storage
- Daily sales history
- Basic reports
- Simple authentication

### 🔜 Phase 3 - Multi-terminal and UX Improvements

- Support for multiple terminals
- Table assignment
- Ticket printing
- Excel/PDF exports

### 🔜 Phase 4 - Integrations and Scaling

- POS/payment methods integration
- Advanced dashboard with analytics
- API for online ordering
- Automatic backup

---

## 🐛 Troubleshooting

### Database won't connect

```bash
# Check if Docker is running
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres

# Restart container
docker-compose restart postgres
```

### Backend won't start

```bash
# Check environment variables
cd backend
cat .env

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Regenerate Prisma Client
npm run prisma:generate
```

### Frontend won't connect to backend

- Verify backend is running on port 3000
- Check CORS configuration in `backend/src/index.ts`
- Check browser console for errors

### Migration errors

```bash
# Reset database (deletes everything)
cd backend
npm run db:reset

# Recreate and seed
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
- **Angular components**: PascalCase (e.g., `MenuList`)

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
├── app/              # Main configuration
├── components/       # Angular components
├── core/
│   ├── services/     # Angular services
│   ├── guards/       # Route guards
│   └── interceptors/ # HTTP interceptors
├── shared/           # Shared components
└── layout/           # Layout and themes
```

---

## 🤝 Contributing

This is an individual development project. For questions or suggestions, open an issue.

---

## 📄 License

Private project - All rights reserved

---

## 📞 Useful Resources

- [Prisma Docs](https://www.prisma.io/docs)
- [Angular Docs](https://angular.dev)
- [Express + TypeScript](https://github.com/microsoft/TypeScript-Node-Starter)
- [Zod Validation](https://zod.dev)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [DaisyUI](https://daisyui.com)

---

## 🗂️ Important Files

- [`Fase 1 - App Marisquería.md`](./Fase%201%20-%20App%20Marisquería.md) - Original technical specification
- [`backend/prisma/schema.prisma`](./backend/prisma/schema.prisma) - Data model
- [`backend/prisma/prisma.config.ts`](./backend/prisma/prisma.config.ts) - Prisma 7 configuration
- [`backend/prisma/seed.ts`](./backend/prisma/seed.ts) - Sample data
- [`docker-compose.yml`](./docker-compose.yml) - PostgreSQL configuration
