import { z } from 'zod';

export const accountIdSchema = z.uuid();
export const createClaimSchema = z.strictObject({
  gameId: z.uuid(),
  gamePlatformId: z.uuid(),
  handle: z.string().min(1).max(256),
});
export const resubmitSchema = z.strictObject({});
const note = z.string().trim().min(1).max(500).optional();
export const emptyActionSchema = z.strictObject({});
export const rejectSchema = z.strictObject({
  reasonCode: z.enum([
    'HANDLE_NOT_FOUND',
    'OWNERSHIP_NOT_PROVEN',
    'DUPLICATE_ACCOUNT',
    'INVALID_PLATFORM',
    'INSUFFICIENT_INFORMATION',
    'OTHER',
  ]),
  note,
});
export const suspendSchema = z.strictObject({
  reasonCode: z.enum([
    'OWNERSHIP_DISPUTE',
    'ACCOUNT_TRANSFERRED',
    'POLICY_VIOLATION',
    'SECURITY_REVIEW',
    'OTHER',
  ]),
  note,
});
export const adminFilterSchema = z.enum([
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'SUSPENDED',
  'DISCONNECTED',
]);
