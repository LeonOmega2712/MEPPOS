# Menu System - MEPPOS

## System Overview

This document describes the complete menu system implemented for MEPPOS (Seafood Restaurant POS). The system replaces the previous simple model (`Product` + `ProductVariant`) with a more robust and scalable architecture.

---

## Data Model

### Main Entities

#### 1. **MenuCategory** (Menu Categories)

Organizes the menu hierarchically in a tree structure.

**Fields:**

- `id` (UUID): Unique identifier
- `name` (string): Category name (e.g., "Drinks", "Food")
- `nameKey` (string, optional): Key for future i18n
- `description` (text, optional): Category description
- `parentId` (UUID, optional): Parent category ID (null if root)
- `sortOrder` (int): Display order
- `isActive` (boolean): Active/inactive status
- `createdAt`, `updatedAt` (timestamp)

**Relationships:**

- Self-reference: A category can have subcategories
- `1:N` with MenuItem: A category can have many items

**Examples:**

```bash
Drinks (root)
  ├─ Soda
  │   ├─ Screw Cap
  │   │   └─ Coca-cola
  │   ├─ Can
  │   └─ Returnable
  ├─ Beer
  └─ Water
```

---

#### 2. **MenuItem** (Menu Items)

Represents a product/dish/drink in the menu.

**Fields:**

- `id` (UUID): Unique identifier
- `categoryId` (UUID): Category ID
- `name` (string): Item name
- `nameKey` (string, optional): Key for i18n
- `description` (text, optional): Item description
- `imageUrl` (string, optional): Image URL
- `sortOrder` (int): Display order
- `isActive` (boolean): Active/inactive status
- `isConfigurable` (boolean): Allows ingredient selection
- `hasVariants` (boolean): Has variants (sizes, flavors, etc.)
- `basePrice` (decimal, optional): Base price if NO variants
- `createdAt`, `updatedAt` (timestamp)

**Relationships:**

- `N:1` with MenuCategory
- `1:N` with MenuVariant
- `N:M` with Ingredient (through MenuItemIngredient)

**Business Rules:**

- If `hasVariants = false`, MUST have `basePrice`
- If `hasVariants = true`, MUST have at least one variant
- If `isConfigurable = true`, MUST have at least one ingredient

---

#### 3. **VariantType** (Variant Types)

Defines the type of variation (size, flavor, type, brand).

**Fields:**

- `id` (UUID): Unique identifier
- `name` (string, unique): Type name (e.g., "Size", "Flavor")
- `nameKey` (string, optional): Key for i18n
- `sortOrder` (int): Display order
- `createdAt`, `updatedAt` (timestamp)

**Relationships:**

- `1:N` with MenuVariant

**Examples:**

- Size: Small, Medium, Large
- Flavor: Mango, Guava, Strawberry
- Type: Regular, Light, Zero

---

#### 4. **MenuVariant** (Item Variants)

Specific variation of a menu item.

**Fields:**

- `id` (UUID): Unique identifier
- `menuItemId` (UUID): Item ID it belongs to
- `variantTypeId` (UUID): Variant type ID
- `name` (string): Variant name (e.g., "Small", "Large")
- `nameKey` (string, optional): Key for i18n
- `price` (decimal): Variant price
- `sortOrder` (int): Display order
- `isActive` (boolean): Active/inactive status
- `createdAt`, `updatedAt` (timestamp)

**Relationships:**

- `N:1` with MenuItem
- `N:1` with VariantType

**Important Note:**

- Each variant is **unique and complete**
- Example: "Coca-cola Small Regular" is ONE variant, not a combination

---

#### 5. **Ingredient** (Ingredients)

Available ingredients for configurable items.

**Fields:**

- `id` (UUID): Unique identifier
- `name` (string): Ingredient name
- `nameKey` (string, optional): Key for i18n
- `sortOrder` (int): Display order
- `isActive` (boolean): Active/inactive status
- `createdAt`, `updatedAt` (timestamp)

**Relationships:**

- `N:M` with MenuItem (through MenuItemIngredient)

**Usage:**

- Seafood: Shrimp, Squid, Oyster, Abalone
- For items like Cocktails and Tostadas that allow ingredient selection

---

#### 6. **MenuItemIngredient** (Junction Table)

Relates menu items with ingredients.

**Fields:**

- `id` (UUID): Unique identifier
- `menuItemId` (UUID): Item ID
- `ingredientId` (UUID): Ingredient ID
- `isDefault` (boolean): If it's a default ingredient for the item
- `createdAt` (timestamp)

**Usage:**

- Configurable items: `isDefault = false` (user chooses)
- Fixed items: `isDefault = true` (always included)
- Example: Seafood soup ALWAYS has all 4 seafood types (`isDefault = true`)

---

## Backend Folder Structure

```bash
backend/
├── src/
│   ├── controllers/
│   │   ├── menu.controller.ts
│   │   ├── category.controller.ts
│   │   ├── ingredient.controller.ts
│   │   └── variant-type.controller.ts
│   ├── services/
│   │   ├── menu.service.ts
│   │   └── category.service.ts
│   ├── validation/
│   │   └── validation.schemas.ts
│   ├── types/
│   │   └── types.ts
│   ├── routes/
│   │   └── index.ts
│   └── index.ts
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── package.json
└── tsconfig.json
```

---

## API Endpoints

### Categories

#### `GET /api/categories`

Get all categories (flat list).

**Query Parameters:**

- `parentId` (UUID, optional): Filter by parent category
- `isActive` (boolean, optional): Filter by status
- `search` (string, optional): Search in name/description

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Drinks",
      "parentId": null,
      "sortOrder": 1,
      "_count": {
        "children": 3,
        "items": 0
      }
    }
  ],
  "count": 1
}
```

---

#### `GET /api/categories/tree`

Get complete category tree (hierarchical).

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Drinks",
      "children": [
        {
          "id": "uuid",
          "name": "Soda",
          "children": [...],
          "items": [...]
        }
      ],
      "items": []
    }
  ]
}
```

---

#### `GET /api/categories/root`

Get only root categories (no parent).

---

#### `GET /api/categories/:id`

Get a specific category with its children and items.

---

#### `GET /api/categories/:id/path`

Get breadcrumb path for a category.

**Response:**

```json
{
  "success": true,
  "data": [
    {"id": "uuid", "name": "Drinks"},
    {"id": "uuid", "name": "Soda"},
    {"id": "uuid", "name": "Screw Cap"}
  ]
}
```

---

#### `POST /api/categories`

Create a new category.

**Request Body:**

```json
{
  "name": "New Category",
  "description": "Optional description",
  "parentId": "optional-uuid",
  "sortOrder": 0
}
```

---

#### `PUT /api/categories/:id`

Update a category.

**Validations:**

- Cannot be its own parent
- Cannot create circular references

---

#### `DELETE /api/categories/:id`

Delete a category.

**Query Parameters:**

- `hard` (boolean): true = permanent deletion, false = soft delete

**Validations:**

- Cannot have subcategories
- Cannot have items

---

### Menu Items

#### `GET /api/menu-items`

Get all menu items.

**Query Parameters:**

- `categoryId` (UUID): Filter by category
- `isActive` (boolean): Filter by status
- `isConfigurable` (boolean): Filter configurable items
- `hasVariants` (boolean): Filter with/without variants
- `search` (string): Search in name/description

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Seafood Cocktail",
      "category": {...},
      "hasVariants": true,
      "isConfigurable": true,
      "variants": [
        {
          "id": "uuid",
          "name": "Small",
          "price": 100,
          "variantType": {"name": "Size"}
        }
      ],
      "ingredients": [
        {"id": "uuid", "name": "Shrimp", "isDefault": false}
      ]
    }
  ],
  "count": 1
}
```

---

#### `GET /api/menu-items/:id`

Get a specific item with all its relationships.

---

#### `GET /api/menu-items/category/:categoryId`

Get items from a category.

**Query Parameters:**

- `includeSubcategories` (boolean): Include items from subcategories

---

#### `POST /api/menu-items`

Create a new menu item.

**Request Body (without variants):**

```json
{
  "categoryId": "uuid",
  "name": "Natural Water",
  "description": "Purified water",
  "hasVariants": false,
  "basePrice": 15
}
```

**Request Body (with variants):**

```json
{
  "categoryId": "uuid",
  "name": "Seafood Cocktail",
  "hasVariants": true,
  "isConfigurable": true,
  "variants": [
    {
      "variantTypeId": "uuid-size",
      "name": "Small",
      "price": 100,
      "sortOrder": 1
    },
    {
      "variantTypeId": "uuid-size",
      "name": "Large",
      "price": 150,
      "sortOrder": 2
    }
  ],
  "ingredientIds": ["uuid-shrimp", "uuid-squid", "uuid-oyster", "uuid-abalone"]
}
```

---

#### `PUT /api/menu-items/:id`

Update a menu item.

**Note:** If variants are sent, all existing ones are replaced.

---

#### `DELETE /api/menu-items/:id`

Delete a menu item.

**Query Parameters:**

- `hard` (boolean): true = permanent, false = soft delete

---

### Variants

#### `POST /api/menu-items/:id/variants`

Add a variant to an existing item.

**Request Body:**

```json
{
  "variantTypeId": "uuid",
  "name": "Extra Large",
  "price": 200,
  "sortOrder": 3
}
```

---

#### `PUT /api/variants/:id`

Update a variant.

---

#### `DELETE /api/variants/:id`

Delete a variant.

---

### Variant Types

#### `GET /api/variant-types`

Get all variant types.

---

#### `POST /api/variant-types`

Create a new variant type.

**Request Body:**

```json
{
  "name": "Flavor",
  "nameKey": "flavor",
  "sortOrder": 1
}
```

---

### Ingredients

#### `GET /api/ingredients`

Get all ingredients.

---

#### `POST /api/ingredients`

Create a new ingredient.

**Request Body:**

```json
{
  "name": "Shrimp",
  "nameKey": "shrimp",
  "sortOrder": 1
}
```

---

## Migrations and Seed

### Apply Migrations

```bash
cd backend
npm run prisma:migrate
```

### Run Seed

```bash
npm run prisma:seed
```

The seed creates:

- 4 variant types (Size, Type, Flavor, Brand)
- 4 ingredients (seafood)
- Complete menu structure based on `menu.md`
- All items with their variants and ingredients

---

## Common Use Cases

### 1. Get Complete Menu

```typescript
// GET /api/categories/tree
const menu = await fetch('http://localhost:3000/api/categories/tree');
```

### 2. Create Simple Item (no variants)

```typescript
// POST /api/menu-items
const item = {
  categoryId: "uuid-drinks",
  name: "Mineral Water",
  hasVariants: false,
  basePrice: 20
};
```

### 3. Create Item with Variants

```typescript
const item = {
  categoryId: "uuid-beer",
  name: "Corona",
  hasVariants: true,
  variants: [
    {
      variantTypeId: "uuid-size",
      name: "Regular",
      price: 35
    },
    {
      variantTypeId: "uuid-size",
      name: "Large",
      price: 60
    }
  ]
};
```

### 4. Create Configurable Item (with ingredients)

```typescript
const item = {
  categoryId: "uuid-food",
  name: "Custom Cocktail",
  hasVariants: true,
  isConfigurable: true,
  variants: [
    {variantTypeId: "uuid-size", name: "Large", price: 150}
  ],
  ingredientIds: ["uuid-shrimp", "uuid-squid"]
};
```

---

## Differences vs Previous System

| Aspect | Previous System | New System |
| -------- | ---------------- | ------------ |
| Categories | Not supported | Hierarchical (tree) |
| Variants | Only size/price | Typed (Size, Flavor, Type) |
| Ingredients | Not supported | Complete N:M relationship |
| Internationalization | Not prepared | `nameKey` fields ready |
| Ordering | Limited | `sortOrder` field everywhere |
| Soft Delete | No | `isActive` in entities |
| Images | No | Optional `imageUrl` field |

---

## Future Phases

### Phase 2: Sales Persistence

- Add `Orders` table (bills)
- Add `OrderItems` table (bill items)
- Sales history
- Basic reports

### Phase 3: Price History

- `MenuVariantPriceHistory` table
- Price change tracking
- Reports with historical prices

### Phase 4: Internationalization

- `Translation` table
- Complete multi-language support
- UI for managing translations

---

## Development Notes

### Conventions

- All source code in **English**
- Documentation and UI in **Spanish**
- Table names in **snake_case**
- Property names in **camelCase**
- Validations with **Zod**

### Performance

- Indexes on frequently searched fields
- `sortOrder` indexed for fast ordering
- `isActive` indexed for common filters

### Security

- Zod validation on all endpoints
- Circular reference prevention in categories
- Dependency validation before deletion

---

## Support

For questions or issues:

1. Review this documentation
2. Check validation schemas in `validation.schemas.ts`
3. Review seed examples in `seed.ts`
