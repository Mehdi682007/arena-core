import { z } from 'zod';
const uuid = z.uuid();
const amount = z.string().regex(/^[1-9]\d{0,12}$/);
const key = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9:_-]+$/);
const reasonCode = z.enum([
  'FOUNDATION_TEST',
  'PROMOTIONAL_GRANT',
  'OPERATIONAL_CORRECTION',
  'OTHER',
]);
export const userIdSchema = uuid;
export const transactionIdSchema = uuid;
export const ledgerQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: uuid.optional(),
    type: z
      .enum([
        'ISSUANCE',
        'ADMIN_ADJUSTMENT',
        'REVERSAL',
        'MATCH_ENTRY_RESERVATION',
        'MATCH_ENTRY_REFUND',
      ])
      .optional(),
    direction: z.enum(['DEBIT', 'CREDIT']).optional(),
  })
  .strict();
export const issueSchema = z
  .object({
    amount,
    idempotencyKey: key,
    reasonCode,
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
export const adjustSchema = issueSchema.extend({ direction: z.enum(['DEBIT', 'CREDIT']) }).strict();
export const reverseSchema = z
  .object({
    idempotencyKey: key,
    reasonCode,
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
