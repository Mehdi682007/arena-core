import type {
  LoginIdentityRecord,
  ResetTokenRecord,
  SessionRecord,
  UserSecurityRecord,
  UserSessionSummaryRecord,
  VerificationTokenRecord,
} from '../domain/identity-types';

export interface RegistrationWrite {
  readonly email: string;
  readonly normalizedEmail: string;
  readonly passwordHash: string;
  readonly passwordAlgorithm: string;
  readonly verificationTokenHash: string;
  readonly verificationExpiresAt: Date;
  readonly profile?: Readonly<{
    displayName: string;
    locale: 'fa' | 'en';
    timezone: string;
    countryCode?: string;
  }>;
}

export interface IdentityRepository {
  emailExists(normalizedEmail: string): Promise<boolean>;
  createRegistration(
    input: RegistrationWrite,
  ): Promise<Readonly<{ userId: string; emailId: string }>>;
  findLoginIdentity(normalizedEmail: string): Promise<LoginIdentityRecord | null>;
  recordAuthenticationFailure(
    userId: string,
    failedAttemptCount: number,
    lockedUntil: Date | null,
  ): Promise<void>;
  recordAuthenticationSuccess(
    userId: string,
    at: Date,
    rehash?: Readonly<{ hash: string; algorithm: string }>,
  ): Promise<void>;
  findUser(userId: string): Promise<UserSecurityRecord | null>;
  createSession(input: Omit<SessionRecord, 'id' | 'user' | 'revokedAt'>): Promise<{ id: string }>;

  recoverExpiredSuspension(userId: string): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  listUserSessions(userId: string): Promise<readonly UserSessionSummaryRecord[]>;
  revokeSession(sessionId: string, at: Date, reason: string): Promise<void>;
  revokeOwnedSession(userId: string, sessionId: string, at: Date, reason: string): Promise<boolean>;
  revokeActiveSessions(
    userId: string,
    at: Date,
    reason: string,
    excludeSessionId?: string,
  ): Promise<void>;
  touchSession(sessionId: string, at: Date): Promise<void>;
  findEmail(
    userId: string,
    emailId: string,
  ): Promise<{ id: string; verifiedAt: Date | null } | null>;
  findVerificationIdentity(normalizedEmail: string): Promise<{
    userId: string;
    emailId: string;
    email: string;
    status: string;
    verifiedAt: Date | null;
  } | null>;
  createVerificationToken(input: {
    userEmailId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  consumeActiveVerificationTokens(emailId: string, at: Date): Promise<void>;
  findVerificationToken(tokenHash: string): Promise<VerificationTokenRecord | null>;
  verifyEmailAndConsumeToken(
    tokenId: string,
    emailId: string,
    userId: string,
    activate: boolean,
    at: Date,
  ): Promise<void>;
  findResetIdentity(
    normalizedEmail: string,
  ): Promise<{ userId: string; status: string; verifiedAt: Date | null } | null>;
  createResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    requestedIpHash?: string;
  }): Promise<void>;
  consumeActiveResetTokens(userId: string, at: Date): Promise<void>;
  findResetToken(tokenHash: string): Promise<ResetTokenRecord | null>;
  resetPassword(input: {
    tokenId: string;
    userId: string;
    passwordHash: string;
    passwordAlgorithm: string;
    at: Date;
  }): Promise<number>;
  findCredential(userId: string): Promise<{ passwordHash: string } | null>;
  changePassword(input: {
    userId: string;
    passwordHash: string;
    passwordAlgorithm: string;
    at: Date;
    excludeSessionId?: string;
  }): Promise<number>;
}

export interface IdentityTransactionManager {
  transaction<T>(operation: (repository: IdentityRepository) => Promise<T>): Promise<T>;
}
