import { z } from 'zod';

export const adminUserIdSchema = z.uuid();
export const adminRoleIdSchema = z.uuid();

export const adminUserListQuerySchema = z
  .object({
    term: z.string().trim().min(2).max(128).optional(),
    status: z
      .enum(['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'BANNED', 'DISABLED', 'DELETED'])
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const adminUserStatusSchema = z
  .object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
    reasonCode: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^[A-Z0-9_]+$/)
      .optional(),
    note: z.string().trim().min(2).max(500).optional(),
    suspendedUntil: z.coerce.date().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.status === 'SUSPENDED' || value.status === 'BANNED') &&
      value.reasonCode === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['reasonCode'],
        message: 'A restriction reason is required.',
      });
    }

    if (value.status === 'SUSPENDED' && value.suspendedUntil === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['suspendedUntil'],
        message: 'Suspension expiry is required.',
      });
    }

    if (value.status !== 'SUSPENDED' && value.suspendedUntil !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['suspendedUntil'],
        message: 'Suspension expiry is only valid for SUSPENDED.',
      });
    }
  });

export const adminEmailVerificationSchema = z
  .object({
    reasonCode: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^[A-Z0-9_]+$/)
      .default('ADMIN_EMAIL_VERIFIED'),
    note: z.string().trim().min(2).max(500).optional(),
  })
  .strict();

export const adminUserDeletionSchema = z
  .object({
    reasonCode: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^[A-Z0-9_]+$/),
    note: z.string().trim().min(2).max(500).optional(),
  })
  .strict();

export const adminUserRestoreSchema = z
  .object({
    reasonCode: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^[A-Z0-9_]+$/)
      .default('ADMIN_USER_RESTORED'),
    note: z.string().trim().min(2).max(500).optional(),
  })
  .strict();

export const adminSessionRevocationSchema = z
  .object({
    reasonCode: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^[A-Z0-9_]+$/)
      .default('ADMIN_SESSION_REVOCATION'),
    note: z.string().trim().min(2).max(500).optional(),
  })
  .strict();

export const adminRoleAssignmentSchema = z
  .object({
    roleId: z.uuid(),
    expiresAt: z.coerce.date().optional(),
  })
  .strict();

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;

export type AdminUserStatusInput = z.infer<typeof adminUserStatusSchema>;

export type AdminEmailVerificationInput = z.infer<typeof adminEmailVerificationSchema>;

export type AdminUserDeletionInput = z.infer<typeof adminUserDeletionSchema>;

export type AdminUserRestoreInput = z.infer<typeof adminUserRestoreSchema>;

export type AdminSessionRevocationInput = z.infer<typeof adminSessionRevocationSchema>;

export type AdminRoleAssignmentInput = z.infer<typeof adminRoleAssignmentSchema>;
