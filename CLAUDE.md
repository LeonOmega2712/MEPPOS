# MEPPOS - Seafood Restaurant POS

> Instructions generated from files in `.claude/commands/`. Refer to those files for detailed documentation.

## Hard Rules

- Source code must always be written in English. This includes all code, comments, variable/function names, commit messages, inline code in documentation, and bash/shell comments inside code blocks.
- Documentation (README, specs, and explanations) must be written in English to match the existing codebase convention.
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

## Project: Phase 1 - Bill Calculator

Web app to speed up bill calculation in a seafood restaurant. Editable catalog + real-time calculator.

**Included in Phase 1:** Product catalog CRUD, products with size/price variants, bill calculator (add/edit/remove items), automatic total, simultaneous multi-user use (in-memory sessions), REST API, database only for catalog.

**Excluded from Phase 1:** Sales history, offline support, multi-terminal sync, reports, ticket printing, authentication.

### Tech Stack

- **Frontend:** Angular ^21.0.0, TypeScript ~5.9.2, Tailwind CSS ^4.1.12, DaisyUI ^5.5.14, Angular CDK ^21.1.3, Vitest ^4.0.8
- **Backend:** Node.js 18+, Express.js 5.2.1, TypeScript 5.9.3, Prisma ORM 7.3.0, Zod 4.3.6
- **Database:** PostgreSQL 15+ (tables: `categories`, `products`)
- **Deploy:** Docker + docker-compose (dev), Railway/Render (backend), Netlify/Vercel (frontend)

### Data Model

Full reference in `.claude/commands/menu.mermaid.md`

```
Category (id, name UK, description, base_price?, image, display_order, active)
Product  (id, category_id FK, name UK, description, price?, image, display_order, customizable, active)
```

- `Category` contains `Product` (1:N)
- `price` in Product is nullable (inherits from Category's `base_price` if not set)

### Project Structure

```
MEPPOS/
├── frontend/    # Angular app
├── backend/     # Express API
└── docker-compose.yml
```

### REST API

- `GET    /api/menu` - Get full menu (categories with products, price resolved)
- `GET    /api/categories` - Get all categories (supports ?active=true)
- `GET    /api/categories/:id` - Get category with products
- `POST   /api/categories` - Create category
- `PUT    /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Soft delete (deactivate) category and products. Hard delete with `?permanent=true`
- `PATCH  /api/categories/reorder` - Batch reorder categories (atomic transaction)
- `GET    /api/products` - Get all products with raw price + categories array (supports ?active=true)
- `GET    /api/products/:id` - Get product by ID
- `GET    /api/products/:id/price` - Get resolved price
- `POST   /api/products` - Create product
- `PUT    /api/products/:id` - Update product
- `DELETE /api/products/:id` - Soft delete (deactivate) product. Hard delete with `?permanent=true`
- `PATCH  /api/products/reorder` - Batch reorder products within category (atomic transaction)
- `GET    /api/categories/:categoryId/products` - Get products by category

### Reference Menu

Full detail in `.claude/commands/menu.md`

Main categories: Seafood, Food (Cocktails, Tostadas, Soup), Beverages (Soft drinks, Beer, Water).

## Detailed Documentation

For full specifications, refer to the files in `.claude/commands/`:

- `project-instructions.md` - Project rules and guidelines
- `Fase 1 - App Marisquería (Calculadora de Cuentas).md` - Full Phase 1 technical specification
- `menu.md` - Complete product catalog
- `menu.mermaid.md` - Data model ER diagram
