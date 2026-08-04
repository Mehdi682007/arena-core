export type UserStatus =
  'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DISABLED' | 'DELETED';
export type SessionStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';
export type TokenKind = 'session' | 'email-verification' | 'password-reset';

export interface UserSecurityRecord {
  readonly id: string;
  readonly status: UserStatus;
  readonly securityVersion: number;
  readonly deletedAt: Date | null;
}

export interface LoginIdentityRecord extends UserSecurityRecord {
  readonly emailId: string;
  readonly passwordHash: string;
  readonly passwordAlgorithm: string;
  readonly failedAttemptCount: number;
  readonly lockedUntil: Date | null;
}

export interface SessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly securityVersion: number;
  readonly status: SessionStatus;
  readonly createdAt: Date;
  readonly lastSeenAt: Date | null;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly ipHash?: string;
  readonly userAgent?: string;
  readonly user: UserSecurityRecord;
}

export interface VerificationTokenRecord {
  readonly id: string;
  readonly userEmailId: string;
  readonly tokenHash: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly email: Readonly<{
    id: string;
    userId: string;
    isPrimary: boolean;
    verifiedAt: Date | null;
    userStatus: UserStatus;
  }>;
}

export interface ResetTokenRecord {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}
