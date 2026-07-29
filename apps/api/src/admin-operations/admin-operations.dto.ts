import { z } from 'zod';
import { auditActions } from '@arena-core/admin-operations';
export const idSchema = z.uuid();
export const sourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Z0-9_]+$/);
export const sourceIdSchema = z.string().trim().min(1).max(128);
export const auditQuerySchema = z
  .object({
    actorUserId: z.uuid().optional(),
    targetType: sourceSchema.optional(),
    targetId: z.string().trim().min(1).max(128).optional(),
    action: z.enum(auditActions).optional(),
    createdFrom: z.coerce.date().optional(),
    createdTo: z.coerce.date().optional(),
    cursor: z.string().max(1024).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export const searchQuerySchema = z
  .object({
    scope: z.enum(['USER', 'GAME_ACCOUNT', 'MATCH', 'NOTIFICATION', 'WALLET', 'RATING']),
    term: z.string().trim().min(2).max(128),
    limit: z.coerce.number().int().min(1).max(50).default(25),
  })
  .strict();
export const timelineQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export const emptyBodySchema = z.object({}).strict();
