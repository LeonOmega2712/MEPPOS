# MEPPOS - Seafood Restaurant POS System

Point of Sale (POS) system for seafood restaurants, built with Angular and Node.js.

## 🏗️ Project Structure (Mono-repo)

```
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

# Generate Prisma Client
npm run prisma:generate

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

### Menu System

The complete menu system is documented in [`MENU_SYSTEM.md`](./MENU_SYSTEM.md).

### Main Endpoints

#### Categories
- `GET /api/categories` - List all categories
- `GET /api/categories/tree` - Hierarchical category tree
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

#### Menu Items
- `GET /api/menu-items` - List all items
- `GET /api/menu-items/:id` - Get an item
- `GET /api/menu-items/category/:categoryId` - Items by category
- `POST /api/menu-items` - Create item
- `PUT /api/menu-items/:id` - Update item
- `DELETE /api/menu-items/:id` - Delete item

#### Variants
- `POST /api/menu-items/:id/variants` - Add variant
- `PUT /api/variants/:id` - Update variant
- `DELETE /api/variants/:id` - Delete variant

#### Variant Types
- `GET /api/variant-types` - List variant types
- `POST /api/variant-types` - Create variant type

#### Ingredients
- `GET /api/ingredients` - List ingredients
- `POST /api/ingredients` - Create ingredient

### Health Check

- `GET /health` - Check server status
- `GET /api` - Endpoint documentation

---

## 🛠️ Tech Stack

### Frontend
- Angular 21+
- TypeScript
- Tailwind CSS v4
- DaisyUI

### Backend
- Node.js 18+
- Express.js
- TypeScript
- Prisma ORM
- Zod (validation)

### Database
- PostgreSQL 15+

### Data Model

The system uses 6 main tables:

1. **menu_categories** - Hierarchical menu organization
2. **menu_items** - Products/dishes/drinks
3. **variant_types** - Variation types (size, flavor, type)
4. **menu_variants** - Specific variants with prices
5. **ingredients** - Ingredients for configurable items
6. **menu_item_ingredients** - Items-ingredients relationship (N:M)

See [`MENU_SYSTEM.md`](./MENU_SYSTEM.md) for complete model documentation.

---

## 📖 Project Phases

### ✅ Phase 1 (Completed) - Menu System
- ✅ Product catalog with hierarchical categories
- ✅ Products with variants (size, flavor, type)
- ✅ Configurable ingredients
- ✅ Complete menu CRUD
- ✅ Complete REST API
- ✅ Zod validations
- ✅ Seed with sample data

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
- **Table names**: snake_case (e.g., `menu_items`)
- **TypeScript properties**: camelCase (e.g., `menuItems`)
- **Angular components**: PascalCase (e.g., `MenuList`)

### Design Principles

- **SOLID**: Applied in backend architecture
- **DRY**: Don't repeat code
- **Separation of concerns**: Controllers → Services → DB
- **Validation**: Zod on all endpoints
- **Type Safety**: Strict TypeScript

### Backend Folder Structure

```
backend/src/
├── controllers/       # HTTP handlers
├── services/         # Business logic
├── validation/       # Zod schemas
├── types/            # TypeScript types/DTOs
├── routes/           # Route configuration
└── index.ts          # Main server
```

### Frontend Folder Structure

```
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

- [`MENU_SYSTEM.md`](./MENU_SYSTEM.md) - Complete menu system documentation
- [`Fase 1 - App Marisquería.md`](./Fase%201%20-%20App%20Marisquería.md) - Original technical specification
- [`backend/prisma/schema.prisma`](./backend/prisma/schema.prisma) - Data model
- [`backend/prisma/seed.ts`](./backend/prisma/seed.ts) - Sample data
- [`docker-compose.yml`](./docker-compose.yml) - PostgreSQL configuration