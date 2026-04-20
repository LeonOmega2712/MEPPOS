import { z } from 'zod';

const LOCATION_TYPES = ['table', 'bar'] as const;

export const CreateLocationSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(LOCATION_TYPES),
});

export const UpdateLocationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(LOCATION_TYPES).optional(),
  displayOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const LocationIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const ReorderLocationsSchema = z.object({
  locationIds: z.array(z.number().int().positive()).min(1),
});

export type CreateLocationDTO = z.infer<typeof CreateLocationSchema>;
export type UpdateLocationDTO = z.infer<typeof UpdateLocationSchema>;
export type LocationIdDTO = z.infer<typeof LocationIdSchema>;
export type ReorderLocationsDTO = z.infer<typeof ReorderLocationsSchema>;
