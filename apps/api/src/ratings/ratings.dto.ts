import { z } from 'zod';

export const ratingKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/);
export const ratingIdSchema = z.uuid();
export const ratingListSchema = z
  .object({
    cursor: z.string().max(128).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export const leaderboardQuerySchema = ratingListSchema
  .extend({ crossplayGroup: ratingKeySchema.optional() })
  .strict();
export const applyRatingSchema = z
  .object({
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9:_-]+$/),
  })
  .strict();
export const recoverySchema = z
  .object({ limit: z.number().int().min(1).max(100).default(25) })
  .strict();
