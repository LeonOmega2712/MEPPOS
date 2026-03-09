import { z } from 'zod';

export const CreateUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  displayName: z.string().min(1).max(100),
  role: z.enum(['ADMIN', 'WAITER']).default('WAITER'),
  active: z.boolean().default(true),
});

export const UpdateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  password: z.string().min(6).max(100).optional(),
  displayName: z.string().min(1).max(100).optional(),
  role: z.enum(['ADMIN', 'WAITER']).optional(),
  active: z.boolean().optional(),
});

export const UserIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateUserDTO = z.infer<typeof CreateUserSchema>;
export type UpdateUserDTO = z.infer<typeof UpdateUserSchema>;
export type UserIdDTO = z.infer<typeof UserIdSchema>;
