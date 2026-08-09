import { z } from 'zod';
import type {
  GameAccountRejectionReasonCode,
  GameAccountSuspensionReasonCode,
} from '@arena-core/contracts';

export const accountIdSchema = z.uuid();
export const createClaimSchema = z.strictObject({
  gameId: z.uuid(),
  gamePlatformId: z.uuid(),
  handle: z.string().min(1).max(256),
});
export const updateClaimSchema = createClaimSchema.extend({ expectedVersion: z.int().positive() });
export const versionActionSchema = z.strictObject({ expectedVersion: z.int().positive() });
export const resubmitSchema = z.strictObject({});
const note = z.string().trim().min(1).max(500).optional();
export const emptyActionSchema = z.strictObject({});
const rejectionReasonCodes = [
  'HANDLE_NOT_FOUND',
  'OWNERSHIP_NOT_PROVEN',
  'DUPLICATE_ACCOUNT',
  'INVALID_PLATFORM',
  'INSUFFICIENT_INFORMATION',
  'OTHER',
] as const satisfies readonly GameAccountRejectionReasonCode[];
const suspensionReasonCodes = [
  'OWNERSHIP_DISPUTE',
  'ACCOUNT_TRANSFERRED',
  'POLICY_VIOLATION',
  'SECURITY_REVIEW',
  'OTHER',
] as const satisfies readonly GameAccountSuspensionReasonCode[];
export const rejectSchema = z.strictObject({
  reasonCode: z.enum(rejectionReasonCodes),
  note,
  userMessage: note,
  expectedVersion: z.int().positive(),
});
export const requestChangesSchema = rejectSchema;
export const suspendSchema = z.strictObject({
  reasonCode: z.enum(suspensionReasonCodes),
  note,
  userMessage: note,
  expectedVersion: z.int().positive(),
});
export const adminFilterSchema = z.enum([
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'DRAFT',
  'CHANGES_REQUESTED',
  'SUSPENDED',
  'DISCONNECTED',
]);
export const adminGameAccountQuerySchema = z
  .strictObject({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    status: adminFilterSchema.optional(),
    gameId: z.uuid().optional(),
    platformId: z.uuid().optional(),
    reviewerUserId: z.uuid().optional(),
    submittedFrom: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional(),
    submittedTo: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional(),
    recentlyChanged: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    userSearch: z.string().trim().min(1).max(100).optional(),
    externalId: z.string().trim().min(1).max(256).optional(),
  })
  .refine(
    (query) =>
      !query.submittedFrom || !query.submittedTo || query.submittedFrom < query.submittedTo,
    { message: 'submittedFrom must be earlier than submittedTo', path: ['submittedTo'] },
  );
