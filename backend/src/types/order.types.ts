import { z } from 'zod';

// ============================================
// Open order
// ============================================

export const CreateOrderSchema = z.object({
  locationId: z.number().int().positive().optional(),
  notes: z.string().max(1000).optional(),
});

// ============================================
// Round items
// ============================================

const OrderItemInputSchema = z
  .object({
    productId: z.number().int().positive().optional(),
    customName: z.string().min(1).max(255).optional(),
    unitPrice: z.number().nonnegative(),
    quantity: z.number().int().min(1).default(1),
    notes: z.string().max(1000).optional(),
  })
  .refine((item) => Boolean(item.productId) !== Boolean(item.customName), {
    message: 'Exactly one of productId or customName must be provided',
    path: ['productId'],
  });

export const AddRoundSchema = z.object({
  items: z.array(OrderItemInputSchema).min(1),
});

export const UpdateOrderItemSchema = z
  .object({
    unitPrice: z.number().nonnegative().optional(),
    quantity: z.number().int().min(1).optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

// ============================================
// List / lookup
// ============================================

export const ListOrdersQuerySchema = z.object({
  mine: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const OrderIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const OrderRoundIdSchema = z.object({
  id: z.coerce.number().int().positive(),
  roundId: z.coerce.number().int().positive(),
});

export const OrderItemIdSchema = z.object({
  id: z.coerce.number().int().positive(),
  roundId: z.coerce.number().int().positive(),
  itemId: z.coerce.number().int().positive(),
});

export type CreateOrderDTO = z.infer<typeof CreateOrderSchema>;
export type OrderItemInputDTO = z.infer<typeof OrderItemInputSchema>;
export type AddRoundDTO = z.infer<typeof AddRoundSchema>;
export type UpdateOrderItemDTO = z.infer<typeof UpdateOrderItemSchema>;
export type ListOrdersQueryDTO = z.infer<typeof ListOrdersQuerySchema>;
export type OrderIdDTO = z.infer<typeof OrderIdSchema>;
export type OrderRoundIdDTO = z.infer<typeof OrderRoundIdSchema>;
export type OrderItemIdDTO = z.infer<typeof OrderItemIdSchema>;
