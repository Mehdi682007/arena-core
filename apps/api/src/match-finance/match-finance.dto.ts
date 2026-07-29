import { z } from 'zod';

export const matchFinanceMatchIdSchema = z.uuid();
export const reserveMatchEntrySchema = z
  .object({
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9:_-]+$/),
  })
  .strict();
export const matchFinanceListSchema = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
  .strict();
export const refundMatchEntrySchema = z
  .object({
    reasonCode: z.enum([
      'MATCH_CANCELLED',
      'MATCH_EXPIRED',
      'MATCH_VOIDED_BEFORE_START',
      'OPERATIONAL_RECOVERY',
      'OTHER',
    ]),
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9:_-]+$/),
    note: z.string().trim().min(1).max(500).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.reasonCode === 'OTHER' && !value.note)
      context.addIssue({ code: 'custom', path: ['note'], message: 'Note is required.' });
  });
export const releaseRecoverySchema = z.object({ matchId: z.uuid() }).strict();
export const recoveryRefundSchema = z
  .object({
    matchId: z.uuid(),
    reasonCode: z.enum([
      'MATCH_CANCELLED',
      'MATCH_EXPIRED',
      'MATCH_VOIDED_BEFORE_START',
      'OPERATIONAL_RECOVERY',
      'OTHER',
    ]),
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9:_-]+$/),
    note: z.string().trim().min(1).max(500).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.reasonCode === 'OTHER' && !value.note)
      context.addIssue({ code: 'custom', path: ['note'], message: 'Note is required.' });
  });
