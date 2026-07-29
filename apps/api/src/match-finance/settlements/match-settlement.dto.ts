import { z } from 'zod';
export const settlementMatchIdSchema = z.uuid();
export const settlementListSchema = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
  .strict();
export const settleMatchSchema = z
  .object({
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9:_-]+$/),
  })
  .strict();
