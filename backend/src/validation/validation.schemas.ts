import { z } from 'zod';

// ============================================
// MENU CATEGORY SCHEMAS
// ============================================

export const CreateMenuCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  nameKey: z.string().max(100).optional(),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true)
});

export const UpdateMenuCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  nameKey: z.string().max(100).optional(),
  description: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional()
});

// ============================================
// VARIANT TYPE SCHEMAS
// ============================================

export const CreateVariantTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  nameKey: z.string().max(100).optional(),
  sortOrder: z.number().int().min(0).optional().default(0)
});

export const UpdateVariantTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  nameKey: z.string().max(100).optional(),
  sortOrder: z.number().int().min(0).optional()
});

// ============================================
// INGREDIENT SCHEMAS
// ============================================

export const CreateIngredientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  nameKey: z.string().max(100).optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true)
});

export const UpdateIngredientSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  nameKey: z.string().max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional()
});

// ============================================
// MENU VARIANT SCHEMAS
// ============================================

export const CreateMenuVariantSchema = z.object({
  variantTypeId: z.string().uuid('Invalid variant type ID'),
  name: z.string().min(1, 'Variant name is required').max(100),
  nameKey: z.string().max(100).optional(),
  price: z.number().positive('Price must be greater than 0'),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true)
});

export const UpdateMenuVariantSchema = z.object({
  variantTypeId: z.string().uuid().optional(),
  name: z.string().min(1).max(100).optional(),
  nameKey: z.string().max(100).optional(),
  price: z.number().positive().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional()
});

// ============================================
// MENU ITEM SCHEMAS
// ============================================

export const CreateMenuItemSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  name: z.string().min(1, 'Name is required').max(255),
  nameKey: z.string().max(100).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().max(500).optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
  isConfigurable: z.boolean().optional().default(false),
  hasVariants: z.boolean(),
  basePrice: z.number().positive().optional(),
  variants: z.array(CreateMenuVariantSchema).optional(),
  ingredientIds: z.array(z.string().uuid()).optional()
}).refine(data => {
  // If no variants, must have base price
  if (!data.hasVariants && !data.basePrice) {
    return false;
  }
  return true;
}, {
  message: 'Base price is required for items without variants',
  path: ['basePrice']
}).refine(data => {
  // If has variants, must provide at least one
  if (data.hasVariants && (!data.variants || data.variants.length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'At least one variant is required for items with variants',
  path: ['variants']
}).refine(data => {
  // If configurable, must have ingredients
  if (data.isConfigurable && (!data.ingredientIds || data.ingredientIds.length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'At least one ingredient is required for configurable items',
  path: ['ingredientIds']
});

export const UpdateMenuItemSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1).max(255).optional(),
  nameKey: z.string().max(100).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().max(500).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isConfigurable: z.boolean().optional(),
  hasVariants: z.boolean().optional(),
  basePrice: z.number().positive().optional().nullable(),
  variants: z.array(CreateMenuVariantSchema).optional(),
  ingredientIds: z.array(z.string().uuid()).optional()
});

// ============================================
// QUERY FILTER SCHEMAS
// ============================================

export const MenuItemFilterSchema = z.object({
  categoryId: z.string().uuid().optional(),
  isActive: z.string().transform(val => val === 'true').optional(),
  isConfigurable: z.string().transform(val => val === 'true').optional(),
  hasVariants: z.string().transform(val => val === 'true').optional(),
  search: z.string().optional()
});

export const MenuCategoryFilterSchema = z.object({
  parentId: z.string().uuid().optional().nullable(),
  isActive: z.string().transform(val => val === 'true').optional(),
  search: z.string().optional()
});

// ============================================
// UTILITY TYPES
// ============================================

export type CreateMenuCategoryInput = z.infer<typeof CreateMenuCategorySchema>;
export type UpdateMenuCategoryInput = z.infer<typeof UpdateMenuCategorySchema>;
export type CreateVariantTypeInput = z.infer<typeof CreateVariantTypeSchema>;
export type UpdateVariantTypeInput = z.infer<typeof UpdateVariantTypeSchema>;
export type CreateIngredientInput = z.infer<typeof CreateIngredientSchema>;
export type UpdateIngredientInput = z.infer<typeof UpdateIngredientSchema>;
export type CreateMenuVariantInput = z.infer<typeof CreateMenuVariantSchema>;
export type UpdateMenuVariantInput = z.infer<typeof UpdateMenuVariantSchema>;
export type CreateMenuItemInput = z.infer<typeof CreateMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof UpdateMenuItemSchema>;
export type MenuItemFilterInput = z.infer<typeof MenuItemFilterSchema>;
export type MenuCategoryFilterInput = z.infer<typeof MenuCategoryFilterSchema>;