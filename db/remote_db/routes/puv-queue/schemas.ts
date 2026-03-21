import { z } from 'zod';

const routeKeySchema = z.string().trim().regex(/^[a-z0-9-]{3,64}$/);
const coordinateSchema = z.tuple([
  z.number().gte(-180).lte(180),
  z.number().gte(-90).lte(90),
]);
const baselineSchema = z.array(z.number().positive()).length(24);
const todSchema = z.array(z.number().min(0).max(10)).length(24);
const holidaySchema = z.string().regex(/^(\d{2}-\d{2}|\d{4}-\d{2}-\d{2})$/);

const queueRouteSchema = z.object({
  route_key: routeKeySchema,
  label: z.string().trim().min(1).max(120),
  origin: coordinateSchema,
  destination: coordinateSchema,
  timezone: z.string().trim().min(1).max(80),
  cache_ttl_ms: z.number().int().min(60_000).max(86_400_000),
  baseline_by_hour: baselineSchema,
  tod_score_by_hour: todSchema,
  holidays: z.array(holidaySchema).max(366),
  is_active: z.boolean(),
  is_default: z.boolean(),
});

const updateQueueRouteObjectSchema = queueRouteSchema.omit({ route_key: true });

export type CreateQueueRouteInput = z.infer<typeof queueRouteSchema>;
export type UpdateQueueRouteInput = z.infer<typeof updateQueueRouteObjectSchema>;

function withDefaultRouteValidation<T extends z.AnyZodObject>(schema: T) {
  return schema.refine((value) => value.is_active || !value.is_default, {
    message: 'Default route must be active',
    path: ['is_default'],
  });
}

export const createQueueRouteSchema = withDefaultRouteValidation(queueRouteSchema);
export const updateQueueRouteSchema = withDefaultRouteValidation(updateQueueRouteObjectSchema);
