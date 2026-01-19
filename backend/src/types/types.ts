// ============================================
// ENTITY TYPES (matching Prisma models)
// ============================================

export interface MenuCategory {
  id: string;
  name: string;
  nameKey: string | null;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  nameKey: string | null;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  isConfigurable: boolean;
  hasVariants: boolean;
  basePrice: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VariantType {
  id: string;
  name: string;
  nameKey: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuVariant {
  id: string;
  menuItemId: string;
  variantTypeId: string;
  name: string;
  nameKey: string | null;
  price: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ingredient {
  id: string;
  name: string;
  nameKey: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuItemIngredient {
  id: string;
  menuItemId: string;
  ingredientId: string;
  isDefault: boolean;
  createdAt: Date;
}

// ============================================
// RESPONSE DTOs (for API responses)
// ============================================

export interface MenuCategoryWithChildren extends MenuCategory {
  children: MenuCategoryWithChildren[];
  items: MenuItemResponse[];
}

export interface MenuItemResponse extends MenuItem {
  category: MenuCategory;
  variants: MenuVariantResponse[];
  ingredients: IngredientResponse[];
}

export interface MenuVariantResponse extends MenuVariant {
  variantType: VariantType;
}

export interface IngredientResponse extends Ingredient {
  isDefault: boolean; // From junction table
}

// Full menu tree response
export interface MenuTreeResponse {
  categories: MenuCategoryWithChildren[];
}

// ============================================
// CREATE/UPDATE DTOs (for requests)
// ============================================

export interface CreateMenuCategoryDto {
  name: string;
  nameKey?: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateMenuCategoryDto {
  name?: string;
  nameKey?: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateMenuItemDto {
  categoryId: string;
  name: string;
  nameKey?: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
  isConfigurable?: boolean;
  hasVariants: boolean;
  basePrice?: number; // Required if hasVariants is false
  variants?: CreateMenuVariantDto[];
  ingredientIds?: string[]; // IDs of ingredients for configurable items
}

export interface UpdateMenuItemDto {
  categoryId?: string;
  name?: string;
  nameKey?: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
  isConfigurable?: boolean;
  hasVariants?: boolean;
  basePrice?: number;
  variants?: CreateMenuVariantDto[];
  ingredientIds?: string[];
}

export interface CreateMenuVariantDto {
  variantTypeId: string;
  name: string;
  nameKey?: string;
  price: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateMenuVariantDto {
  variantTypeId?: string;
  name?: string;
  nameKey?: string;
  price?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateVariantTypeDto {
  name: string;
  nameKey?: string;
  sortOrder?: number;
}

export interface UpdateVariantTypeDto {
  name?: string;
  nameKey?: string;
  sortOrder?: number;
}

export interface CreateIngredientDto {
  name: string;
  nameKey?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateIngredientDto {
  name?: string;
  nameKey?: string;
  sortOrder?: number;
  isActive?: boolean;
}

// ============================================
// QUERY FILTERS
// ============================================

export interface MenuItemFilterDto {
  categoryId?: string;
  isActive?: boolean;
  isConfigurable?: boolean;
  hasVariants?: boolean;
  search?: string; // Search in name/description
}

export interface MenuCategoryFilterDto {
  parentId?: string | null; // null for root categories
  isActive?: boolean;
  search?: string;
}

// ============================================
// VALIDATION HELPERS
// ============================================

export function validateCreateMenuItem(dto: CreateMenuItemDto): string[] {
  const errors: string[] = [];

  if (!dto.name || dto.name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (!dto.categoryId) {
    errors.push('Category ID is required');
  }

  if (!dto.hasVariants && !dto.basePrice) {
    errors.push('Base price is required for items without variants');
  }

  if (dto.hasVariants && (!dto.variants || dto.variants.length === 0)) {
    errors.push('At least one variant is required for items with variants');
  }

  if (dto.isConfigurable && (!dto.ingredientIds || dto.ingredientIds.length === 0)) {
    errors.push('At least one ingredient is required for configurable items');
  }

  return errors;
}

export function validateCreateVariant(dto: CreateMenuVariantDto): string[] {
  const errors: string[] = [];

  if (!dto.name || dto.name.trim().length === 0) {
    errors.push('Variant name is required');
  }

  if (!dto.variantTypeId) {
    errors.push('Variant type ID is required');
  }

  if (!dto.price || dto.price <= 0) {
    errors.push('Price must be greater than 0');
  }

  return errors;
}