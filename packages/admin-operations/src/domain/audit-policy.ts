import { AdminOperationError } from './admin-operation-errors';
const forbidden =
  /(?:password|token|session|credential|secret|ip|normalizedHandle|walletId|ledgerAccountId|escrow)/i;
export function validateAuditMetadata(
  input: unknown,
): Readonly<Record<string, string | number | boolean | null>> {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    throw new AdminOperationError('ADMIN_AUDIT_INVALID');
  const value = input as Record<string, unknown>;
  if (Object.keys(value).length > 20 || JSON.stringify(value).length > 4096)
    throw new AdminOperationError('ADMIN_AUDIT_INVALID');
  for (const [key, item] of Object.entries(value))
    if (
      forbidden.test(key) ||
      ['__proto__', 'prototype', 'constructor'].includes(key) ||
      (item !== null && !['string', 'number', 'boolean'].includes(typeof item))
    )
      throw new AdminOperationError('ADMIN_AUDIT_INVALID');
  return Object.freeze({ ...value }) as Readonly<Record<string, string | number | boolean | null>>;
}
