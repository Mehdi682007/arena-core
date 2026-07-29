export type IdentityErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'INVALID_EMAIL'
  | 'WEAK_PASSWORD'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'ACCOUNT_NOT_ACTIVE'
  | 'ACCOUNT_LOCKED'
  | 'INVALID_TOKEN'
  | 'EXPIRED_TOKEN'
  | 'CONSUMED_TOKEN'
  | 'SESSION_INVALID'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'IDENTITY_CONFLICT'
  | 'IDENTITY_PERSISTENCE_FAILURE'
  | 'IDENTITY_DATABASE_DISABLED';

const safeMessages: Record<IdentityErrorCode, string> = {
  INVALID_CREDENTIALS: 'Credentials are invalid.',
  INVALID_EMAIL: 'Email is invalid.',
  WEAK_PASSWORD: 'Password does not satisfy the configured policy.',
  EMAIL_ALREADY_REGISTERED: 'Email is already registered.',
  ACCOUNT_NOT_ACTIVE: 'Account is not active.',
  ACCOUNT_LOCKED: 'Account is temporarily locked.',
  INVALID_TOKEN: 'Token is invalid.',
  EXPIRED_TOKEN: 'Token is invalid.',
  CONSUMED_TOKEN: 'Token is invalid.',
  SESSION_INVALID: 'Session is invalid.',
  SESSION_EXPIRED: 'Session is invalid.',
  SESSION_REVOKED: 'Session is invalid.',
  IDENTITY_CONFLICT: 'Identity operation conflicts with existing state.',
  IDENTITY_PERSISTENCE_FAILURE: 'Identity persistence operation failed.',
  IDENTITY_DATABASE_DISABLED: 'Identity persistence is disabled.',
};

export class IdentityError extends Error {
  public constructor(
    public readonly code: IdentityErrorCode,
    options?: ErrorOptions,
  ) {
    super(safeMessages[code], options);
    this.name = 'IdentityError';
  }

  public toJSON(): Readonly<{ code: IdentityErrorCode; message: string }> {
    return Object.freeze({ code: this.code, message: this.message });
  }
}
