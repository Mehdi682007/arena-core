import { z } from 'zod';

export const notificationIdSchema = z.uuid();
export const notificationTypeSchema = z.enum([
  'MATCHMAKING_PROPOSAL_CREATED',
  'MATCHMAKING_PROPOSAL_ACCEPTED',
  'MATCH_READY_REQUIRED',
  'MATCH_STARTED',
  'MATCH_RESULT_WAITING',
  'MATCH_RESULT_CONFIRMED',
  'MATCH_RESULT_CONFLICT',
  'MATCH_DISPUTE_OPENED',
  'MATCH_DISPUTE_RESPONSE_RECEIVED',
  'MATCH_DISPUTE_RESOLVED',
  'MATCH_SETTLEMENT_COMPLETED',
  'RATING_UPDATED',
  'SECURITY_SIGN_IN',
]);
export const notificationListSchema = z
  .object({
    cursor: z.string().max(128).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    archived: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    unread: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    type: notificationTypeSchema.optional(),
  })
  .strict();
export const preferenceSchema = z
  .object({
    inAppEnabled: z.boolean(),
    emailEnabled: z.boolean(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export const adminOutboxSchema = z
  .object({
    status: z
      .enum([
        'PENDING',
        'PROCESSING',
        'DELIVERED',
        'RETRY_SCHEDULED',
        'FAILED',
        'DEAD_LETTERED',
        'CANCELLED',
      ])
      .optional(),
    channel: z.enum(['IN_APP', 'EMAIL']).optional(),
    type: notificationTypeSchema.optional(),
    attemptMin: z.coerce.number().int().min(0).optional(),
    cursor: z.string().max(128).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export const recoverySchema = z
  .object({ limit: z.number().int().min(1).max(100).default(25) })
  .strict();
export const sourceRecoverySchema = z
  .object({
    sourceType: z.enum([
      'MATCHMAKING_PROPOSAL',
      'MATCH',
      'MATCH_RESULT',
      'MATCH_DISPUTE',
      'MATCH_SETTLEMENT',
      'RATING_APPLICATION',
    ]),
    sourceId: z.uuid(),
  })
  .strict();
