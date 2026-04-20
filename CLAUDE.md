# MEPPOS - Seafood Restaurant POS

> Reference documentation in `.claude/docs/`. Slash commands in `.claude/commands/`.

## Hard Rules

- Source code must always be written in English. This includes all code, comments, variable/function names, commit messages, inline code in documentation, and bash/shell comments inside code blocks.
- Documentation (README, specs, and explanations) must be written in English to match the existing codebase convention. Exception: phase specification documents (`.claude/docs/phases/`) are written in Spanish.
- Before proposing, modifying, or refactoring code, review the repository and work only on the latest available version. Assuming intermediate code states is not allowed.
- The project must be compatible with both Windows and macOS.
- SOLID and DRY principles must be strictly applied whenever code is generated.
- Only the latest stable versions of libraries, frameworks, and dependencies must be used, unless there is a documented technical justification.
- Code comments must be kept to a minimum and only included when they provide real value or clarify non-obvious decisions.
- Component styles must always be placed in a separate `.css` file using `styleUrl`, never inline in the `.ts` file via `styles`.
- If critical information is missing to proceed correctly, it must be requested before responding. Assumptions are not allowed.
- Keep the README.md file updated when changes require it.

## Guidelines

- The system's primary language is Spanish, but it must be designed from the start with multi-language support on the front-end using internationalization (i18n) best practices.
- Use appropriate architectural patterns according to the project context. Front-end and back-end may use different patterns if this improves clarity, scalability, and maintainability.
- Official documentation of the tools and technologies used must be the primary technical reference.
- Technical quality is the top priority: responses must be well-founded, justify decisions, and propose better alternatives when they exist, even if they contradict the initial instruction, always with solid arguments.
- When planning or implementing any feature, proactively adopt the perspective of the relevant domain expert and surface optimizations without waiting for a second prompt. For frontend work: consider UX, accessibility, perceived performance, and feedback clarity. For backend work: consider reliability, error handling, security, and scalability. For QA/testing: consider edge cases, coverage gaps, and regression risk. Flag findings and apply high-priority improvements as part of the initial implementation.

## Project: Phase 1 - Bill Calculator

Web app to speed up bill calculation in a seafood restaurant. Editable catalog + real-time calculator.

**Included in Phase 1:** Product catalog CRUD, products with size/price variants, bill calculator (add/edit/remove items), automatic total, simultaneous multi-user use (in-memory sessions), REST API, database only for catalog.

**Excluded from Phase 1:** Sales history, offline support, multi-terminal sync, reports, ticket printing.

## Project: Phase 2 - Bill Registration & Ticket Printing (in progress)

Persistent bill management with rounds, kitchen/final ticket printing, and location-based seating. Current progress: JWT authentication with roles (ADMIN/WAITER), login page, protected routes, public menu for QR access, user CRUD, security hardening, locations management (DB + backend API + admin UI — tables + bar; bar orders receive an auto-assigned daily consecutive number), and custom extras management (DB + backend API + admin UI) are complete. Pending: persistent orders with rounds, discounts at checkout, account ownership & transfer, ticket printing (kitchen + final), order history with reprint.

### Tech Stack

- **Frontend:** Angular ^21.0.0, TypeScript ~5.9.2, Tailwind CSS ^4.1.12, DaisyUI ^5.5.14, Angular CDK ^21.1.3, Vitest ^4.0.8
- **Backend:** Node.js 18+, Express.js 5.2.1, TypeScript 5.9.3, Prisma ORM 7.3.0, Zod 4.3.6, bcryptjs, jsonwebtoken, helmet, express-rate-limit, cookie-parser
- **Database:** PostgreSQL 15+ (tables: `categories`, `products`, `users`, `custom_extras`, `locations`)
- **Deploy:** Docker + docker-compose (dev), Koyeb (backend), Netlify/Vercel (frontend)

### Data Model

Full menu reference in `.claude/docs/menu.mermaid.md`

```
Category    (id, name UK, description, base_price?, image, display_order, active)
Product     (id, category_id FK, name UK, description, price?, image, display_order, customizable, active)
User        (id, username UK, password, display_name, role [ADMIN|WAITER], active)
CustomExtra (id, name UK, default_price, active, created_by FK→User?)
Location    (id, name, type [table|bar], display_order, active)
```

- `Category` contains `Product` (1:N)
- `price` in Product is nullable (inherits from Category's `base_price` if not set)
- `Location.type` is enforced as `table` or `bar` via a DB CHECK constraint
- Bar orders receive an auto-assigned numeric identifier stored on the future `orders.bar_position` column (daily consecutive, resets at 00:00 local time). No separate identifier table is needed.

### Project Structure

```
MEPPOS/
├── frontend/    # Angular app
├── backend/     # Express API
└── docker-compose.yml
```

### REST API

**Public routes (no authentication):**

- `GET    /api/menu` - Get full menu (categories with products, price resolved)
- `POST   /api/auth/login` - Login (returns access token + refresh cookie)
- `POST   /api/auth/refresh` - Refresh access token (via httpOnly cookie)
- `POST   /api/auth/logout` - Logout (clears refresh cookie)

**Authenticated routes (any role):**

- `GET    /api/auth/me` - Get current user info
- `GET    /api/categories` - Get all categories (supports ?active=true)
- `GET    /api/categories/:id` - Get category with products
- `GET    /api/categories/:categoryId/products` - Get products by category
- `GET    /api/products` - Get all products with raw price + categories array (supports ?active=true)
- `GET    /api/products/:id` - Get product by ID
- `GET    /api/products/:id/price` - Get resolved price
- `GET    /api/locations` - Get all locations (supports ?active=true)
- `GET    /api/extras` - Get all custom extras (supports ?active=true)
- `POST   /api/extras` - Create custom extra
- `PUT    /api/extras/:id` - Update custom extra
- `DELETE /api/extras/:id` - Soft delete (deactivate) extra. Hard delete with `?permanent=true`

**Admin-only routes:**

- `POST   /api/categories` - Create category
- `PUT    /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Soft delete (deactivate) category and products. Hard delete with `?permanent=true`
- `PATCH  /api/categories/reorder` - Batch reorder categories (atomic transaction)
- `POST   /api/products` - Create product
- `PUT    /api/products/:id` - Update product
- `DELETE /api/products/:id` - Soft delete (deactivate) product. Hard delete with `?permanent=true`
- `PATCH  /api/products/reorder` - Batch reorder products within category (atomic transaction)
- `GET    /api/users` - Get all users
- `GET    /api/users/:id` - Get user by ID
- `POST   /api/users` - Create user
- `PUT    /api/users/:id` - Update user
- `DELETE /api/users/:id` - Soft delete (deactivate) user
- `POST   /api/locations` - Create location
- `PUT    /api/locations/:id` - Update location
- `DELETE /api/locations/:id` - Soft delete (deactivate) location. Hard delete with `?permanent=true`
- `PATCH  /api/locations/reorder` - Batch reorder locations (atomic transaction)

### Reference Menu

Full detail in `.claude/docs/menu.md`

Main categories: Seafood, Food (Cocktails, Tostadas, Soup), Beverages (Soft drinks, Beer, Water).

## Detailed Documentation

For full specifications, refer to the files in `.claude/docs/`:

- `project-instructions.md` - Project rules and guidelines
- `menu.md` - Complete product catalog
- `menu.mermaid.md` - Data model ER diagram

Phase specifications (in Spanish) in `.claude/docs/phases/`:

- `Fase 1 - App Marisquería (Calculadora de Cuentas).md` - Phase 1 technical specification
- `Fase 2 - App Marisqueria (Registro de Cuentas).md` - Phase 2 technical specification
