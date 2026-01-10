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

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose (for PostgreSQL)
- npm or pnpm

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd MEPPOS
```

### 2. Setup and start the database

```bash
# Start PostgreSQL with Docker
docker-compose up -d

# Verify it's running
docker-compose ps
```

### 3. Setup the Backend

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

# Seed database with sample data (optional)
npm run prisma:seed

# Start development server
npm run dev
```

Backend will be running at `http://localhost:3000`

### 4. Setup the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

Frontend will be running at `http://localhost:4200`

## 📦 Available Scripts

### Backend (`/backend`)

```bash
npm run dev          # Development with hot-reload
npm run build        # Compile to JavaScript
npm start            # Run compiled version
npm run prisma:migrate    # Create/apply migrations
npm run prisma:studio     # Open Prisma Studio (DB GUI)
npm run prisma:seed       # Seed database with sample data
```

### Frontend (`/frontend`)

```bash
npm start            # Development server
npm run build        # Production build
npm test             # Run tests
```

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

## 🔧 Configuration

### Environment Variables

**Backend** (`backend/.env`):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/meppos_db"
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:4200
```

## 📚 API Endpoints

### Products

- `GET /api/products` - List all products
- `GET /api/products/:id` - Get a product
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Health Check

- `GET /health` - Check server status

## 🛠️ Tech Stack

### Frontend
- Angular 17+
- TypeScript
- Tailwind CSS
- DaisyUI

### Backend
- Node.js 18+
- Express.js
- TypeScript
- Prisma ORM
- Zod (validation)

### Database
- PostgreSQL 15

## 📖 Project Phases

### ✅ Phase 1 (Current) - MVP Calculator
- Product catalog with variants
- Real-time bill calculator
- Product CRUD
- No sales persistence

### 🔜 Phase 2 - Persistence and Reports
- Sales storage
- Daily history
- Basic reports
- Authentication

### 🔜 Phase 3 - Multi-terminal
- Support for multiple terminals
- Table assignment
- Ticket printing

### 🔜 Phase 4 - Integrations
- Payment gateway integration
- Advanced dashboard
- Public API

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
- Check CORS in `backend/src/index.ts`
- Review browser console for errors

## 📝 Development Notes

- This project uses **mono-repo** with frontend and backend in the same repository
- Database runs in Docker for easier development
- In production, use a managed PostgreSQL database
- Frontend and backend are deployed separately

## 🤝 Contributing

This is an individual development project. For questions or suggestions, open an issue.

## 📄 License

Private project - All rights reserved