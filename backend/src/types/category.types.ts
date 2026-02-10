import { z } from 'zod';

// ============================================
// CATEGORY SCHEMAS
// ============================================

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  basePrice: z.number().positive().optional(),
  image: z.string().max(500).optional(),
  displayOrder: z.number().int().optional(),
  active: z.boolean().default(true)
});

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  basePrice: z.number().positive().optional().nullable(),
  image: z.string().max(500).optional().nullable(),
  displayOrder: z.number().int().optional(),
  active: z.boolean().optional()
});

export const CategoryIdSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const ReorderCategoriesSchema = z.object({
  categoryIds: z.array(z.number().int().positive()).min(1)
});

// ============================================
// CATEGORY TYPES
// ============================================

export type CreateCategoryDTO = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryDTO = z.infer<typeof UpdateCategorySchema>;
export type CategoryIdDTO = z.infer<typeof CategoryIdSchema>;
export type ReorderCategoriesDTO = z.infer<typeof ReorderCategoriesSchema>;
