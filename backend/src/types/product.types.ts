import { z } from 'zod';

// ============================================
// PRODUCT SCHEMAS
// ============================================

export const CreateProductSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  image: z.string().max(500).optional(),
  displayOrder: z.number().int().default(0),
  customizable: z.boolean().default(false),
  active: z.boolean().default(true)
});

export const UpdateProductSchema = z.object({
  categoryId: z.number().int().positive().optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  price: z.number().positive().optional().nullable(),
  image: z.string().max(500).optional().nullable(),
  displayOrder: z.number().int().optional(),
  customizable: z.boolean().optional(),
  active: z.boolean().optional()
});

export const ProductIdSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const ProductsByCategorySchema = z.object({
  categoryId: z.coerce.number().int().positive()
});

// ============================================
// PRODUCT TYPES
// ============================================

export type CreateProductDTO = z.infer<typeof CreateProductSchema>;
export type UpdateProductDTO = z.infer<typeof UpdateProductSchema>;
export type ProductIdDTO = z.infer<typeof ProductIdSchema>;
export type ProductsByCategoryDTO = z.infer<typeof ProductsByCategorySchema>;
