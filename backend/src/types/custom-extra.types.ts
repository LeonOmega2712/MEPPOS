import { z } from 'zod';

export const CreateCustomExtraSchema = z.object({
  name: z.string().min(1).max(255),
  defaultPrice: z.number().positive(),
});

export const UpdateCustomExtraSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  defaultPrice: z.number().positive().optional(),
  active: z.boolean().optional(),
});

export const CustomExtraIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateCustomExtraDTO = z.infer<typeof CreateCustomExtraSchema>;
export type UpdateCustomExtraDTO = z.infer<typeof UpdateCustomExtraSchema>;
export type CustomExtraIdDTO = z.infer<typeof CustomExtraIdSchema>;
