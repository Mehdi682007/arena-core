import { IdentityError } from '../domain/identity-errors';
import type {
  LoginIdentityRecord,
  ResetTokenRecord,
  SessionRecord,
  UserSecurityRecord,
  UserSessionSummaryRecord,
  VerificationTokenRecord,
} from '../domain/identity-types';
import type {
  IdentityRepository,
  IdentityTransactionManager,
  RegistrationWrite,
} from '../ports/identity-repository';
import { Prisma, type ArenaPrismaClient } from '@arena-core/database';

type IdentityPrismaClient = ArenaPrismaClient | Prisma.TransactionClient;

function persistenceError(error: unknown): IdentityError {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return new IdentityError('EMAIL_ALREADY_REGISTERED', { cause: error });
  }
  return new IdentityError('IDENTITY_PERSISTENCE_FAILURE', { cause: error });
}

const userSecuritySelect = {
  id: true,
  status: true,
  securityVersion: true,
  deletedAt: true,
} satisfies Prisma.UserSelect;

export class PrismaIdentityRepository implements IdentityRepository {
  public constructor(private readonly client: IdentityPrismaClient) {}

  public async emailExists(normalizedEmail: string): Promise<boolean> {
    return (
      (await this.client.userEmail.findUnique({
        where: { normalizedEmail },
        select: { id: true },
      })) !== null
    );
  }

  public async createRegistration(
    input: RegistrationWrite,
  ): Promise<{ userId: string; emailId: string }> {
    try {
      const user = await this.client.user.create({
        data: {
          status: 'PENDING_VERIFICATION',
          emails: {
            create: {
              email: input.email,
              normalizedEmail: input.normalizedEmail,
              isPrimary: true,
              verificationTokens: {
                create: {
                  tokenHash: input.verificationTokenHash,
                  expiresAt: input.verificationExpiresAt,
                },
              },
            },
          },
          passwordCredential: {
            create: {
              passwordHash: input.passwordHash,
              passwordAlgorithm: input.passwordAlgorithm,
            },
          },
          ...(input.profile === undefined
            ? {}
            : {
                profile: {
                  create: {
                    displayName: input.profile.displayName,
                    locale: input.profile.locale,
                    timezone: input.profile.timezone,
                    ...(input.profile.countryCode === undefined
                      ? {}
                      : { countryCode: input.profile.countryCode }),
                  },
                },
              }),
        },
        select: { id: true, emails: { select: { id: true } } },
      });
      const emailId = user.emails[0]?.id;
      if (emailId === undefined) throw new Error('Registration email was not created');
      return { userId: user.id, emailId };
    } catch (error) {
      throw persistenceError(error);
    }
  }

  public async findLoginIdentity(normalizedEmail: string): Promise<LoginIdentityRecord | null> {
    const email = await this.client.userEmail.findFirst({
      where: { normalizedEmail, isPrimary: true, verifiedAt: { not: null } },
      select: {
        id: true,
        user: {
          select: {
            ...userSecuritySelect,
            passwordCredential: {
              select: {
                passwordHash: true,
                passwordAlgorithm: true,
                failedAttemptCount: true,
                lockedUntil: true,
              },
            },
          },
        },
      },
    });
    if (email === null || email.user.passwordCredential === null) return null;
    const credential = email.user.passwordCredential;
    return {
      emailId: email.id,
      id: email.user.id,
      status: email.user.status,
      securityVersion: email.user.securityVersion,
      deletedAt: email.user.deletedAt,
      passwordHash: credential.passwordHash,
      passwordAlgorithm: credential.passwordAlgorithm,
      failedAttemptCount: credential.failedAttemptCount,
      lockedUntil: credential.lockedUntil,
    };
  }

  public async recordAuthenticationFailure(
    userId: string,
    failedAttemptCount: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    await this.client.passwordCredential.update({
      where: { userId },
      data: { failedAttemptCount, lockedUntil },
      select: { id: true },
    });
  }

  public async recordAuthenticationSuccess(
    userId: string,
    at: Date,
    rehash?: { hash: string; algorithm: string },
  ): Promise<void> {
    await this.client.user.update({
      where: { id: userId },
      data: {
        lastAuthenticatedAt: at,
        passwordCredential: {
          update: {
            failedAttemptCount: 0,
            lockedUntil: null,
            ...(rehash === undefined
              ? {}
              : {
                  passwordHash: rehash.hash,
                  passwordAlgorithm: rehash.algorithm,
                }),
          },
        },
      },
      select: { id: true },
    });
  }

  public async findUser(userId: string): Promise<UserSecurityRecord | null> {
    return this.client.user.findUnique({
      where: { id: userId },
      select: userSecuritySelect,
    });
  }

  public async recoverExpiredSuspension(userId: string): Promise<void> {
    await this.client.user.updateMany({
      where: {
        id: userId,
        status: 'SUSPENDED',
        suspendedUntil: {
          lte: new Date(),
        },
      },
      data: {
        status: 'ACTIVE',
        suspendedUntil: null,
      },
    });
  }

  public async createSession(
    input: Omit<SessionRecord, 'id' | 'user' | 'revokedAt'>,
  ): Promise<{ id: string }> {
    return this.client.userSession.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        securityVersion: input.securityVersion,
        status: input.status,
        createdAt: input.createdAt,
        lastSeenAt: input.lastSeenAt,
        expiresAt: input.expiresAt,
        ...(input.ipHash === undefined ? {} : { ipHash: input.ipHash }),
        ...(input.userAgent === undefined ? {} : { userAgent: input.userAgent }),
      },
      select: { id: true },
    });
  }

  public async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const session = await this.client.userSession.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        tokenHash: true,
        securityVersion: true,
        status: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: userSecuritySelect },
      },
    });
    return session;
  }

  public async listUserSessions(userId: string): Promise<readonly UserSessionSummaryRecord[]> {
    return this.client.userSession.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
        revokedAt: true,
        userAgent: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  public async revokeSession(sessionId: string, at: Date, reason: string): Promise<void> {
    await this.client.userSession.updateMany({
      where: { id: sessionId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: at, revocationReason: reason },
    });
  }

  public async revokeOwnedSession(
    userId: string,
    sessionId: string,
    at: Date,
    reason: string,
  ): Promise<boolean> {
    const result = await this.client.userSession.updateMany({
      where: { id: sessionId, userId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: at, revocationReason: reason },
    });
    return result.count > 0;
  }

  public async revokeActiveSessions(
    userId: string,
    at: Date,
    reason: string,
    excludeSessionId?: string,
  ): Promise<void> {
    await this.client.userSession.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
        ...(excludeSessionId === undefined ? {} : { id: { not: excludeSessionId } }),
      },
      data: { status: 'REVOKED', revokedAt: at, revocationReason: reason },
    });
  }

  public async touchSession(sessionId: string, at: Date): Promise<void> {
    await this.client.userSession.updateMany({
      where: { id: sessionId, status: 'ACTIVE' },
      data: { lastSeenAt: at },
    });
  }

  public async findEmail(
    userId: string,
    emailId: string,
  ): Promise<{ id: string; verifiedAt: Date | null } | null> {
    return this.client.userEmail.findFirst({
      where: { id: emailId, userId },
      select: { id: true, verifiedAt: true },
    });
  }

  public async findVerificationIdentity(normalizedEmail: string): Promise<{
    userId: string;
    emailId: string;
    email: string;
    status: string;
    verifiedAt: Date | null;
  } | null> {
    const record = await this.client.userEmail.findFirst({
      where: { normalizedEmail, isPrimary: true },
      select: {
        id: true,
        email: true,
        userId: true,
        verifiedAt: true,
        user: { select: { status: true } },
      },
    });
    return record === null
      ? null
      : {
          userId: record.userId,
          emailId: record.id,
          email: record.email,
          status: record.user.status,
          verifiedAt: record.verifiedAt,
        };
  }

  public async createVerificationToken(input: {
    userEmailId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.client.emailVerificationToken.create({
      data: input,
      select: { id: true },
    });
  }

  public async consumeActiveVerificationTokens(emailId: string, at: Date): Promise<void> {
    await this.client.emailVerificationToken.updateMany({
      where: { userEmailId: emailId, consumedAt: null },
      data: { consumedAt: at },
    });
  }

  public async findVerificationToken(tokenHash: string): Promise<VerificationTokenRecord | null> {
    const token = await this.client.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userEmailId: true,
        tokenHash: true,
        createdAt: true,
        expiresAt: true,
        consumedAt: true,
        userEmail: {
          select: {
            id: true,
            userId: true,
            isPrimary: true,
            verifiedAt: true,
            user: { select: { status: true } },
          },
        },
      },
    });
    if (token === null) return null;
    return {
      ...token,
      email: {
        id: token.userEmail.id,
        userId: token.userEmail.userId,
        isPrimary: token.userEmail.isPrimary,
        verifiedAt: token.userEmail.verifiedAt,
        userStatus: token.userEmail.user.status,
      },
    };
  }

  public async verifyEmailAndConsumeToken(
    tokenId: string,
    emailId: string,
    userId: string,
    activate: boolean,
    at: Date,
  ): Promise<void> {
    await this.client.emailVerificationToken.update({
      where: { id: tokenId },
      data: { consumedAt: at },
      select: { id: true },
    });
    await this.client.userEmail.update({
      where: { id: emailId },
      data: { verifiedAt: at },
      select: { id: true },
    });
    if (activate) {
      await this.client.user.updateMany({
        where: { id: userId, status: 'PENDING_VERIFICATION' },
        data: { status: 'ACTIVE' },
      });
    }
  }

  public async findResetIdentity(
    normalizedEmail: string,
  ): Promise<{ userId: string; status: string; verifiedAt: Date | null } | null> {
    const email = await this.client.userEmail.findFirst({
      where: { normalizedEmail, isPrimary: true, verifiedAt: { not: null } },
      select: { userId: true, verifiedAt: true, user: { select: { status: true } } },
    });
    return email === null
      ? null
      : { userId: email.userId, status: email.user.status, verifiedAt: email.verifiedAt };
  }

  public async createResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    requestedIpHash?: string;
  }): Promise<void> {
    await this.client.passwordResetToken.create({
      data: input,
      select: { id: true },
    });
  }

  public async consumeActiveResetTokens(userId: string, at: Date): Promise<void> {
    await this.client.passwordResetToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: at },
    });
  }

  public async findResetToken(tokenHash: string): Promise<ResetTokenRecord | null> {
    return this.client.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        tokenHash: true,
        createdAt: true,
        expiresAt: true,
        consumedAt: true,
      },
    });
  }

  public async resetPassword(input: {
    tokenId: string;
    userId: string;
    passwordHash: string;
    passwordAlgorithm: string;
    at: Date;
  }): Promise<number> {
    await this.client.passwordCredential.update({
      where: { userId: input.userId },
      data: {
        passwordHash: input.passwordHash,
        passwordAlgorithm: input.passwordAlgorithm,
        passwordUpdatedAt: input.at,
        failedAttemptCount: 0,
        lockedUntil: null,
      },
      select: { id: true },
    });
    await this.client.passwordResetToken.update({
      where: { id: input.tokenId },
      data: { consumedAt: input.at },
      select: { id: true },
    });
    const user = await this.client.user.update({
      where: { id: input.userId },
      data: { securityVersion: { increment: 1 } },
      select: { securityVersion: true },
    });
    return user.securityVersion;
  }

  public async findCredential(userId: string): Promise<{ passwordHash: string } | null> {
    return this.client.passwordCredential.findUnique({
      where: { userId },
      select: { passwordHash: true },
    });
  }

  public async changePassword(input: {
    userId: string;
    passwordHash: string;
    passwordAlgorithm: string;
    at: Date;
    excludeSessionId?: string;
  }): Promise<number> {
    await this.client.passwordCredential.update({
      where: { userId: input.userId },
      data: {
        passwordHash: input.passwordHash,
        passwordAlgorithm: input.passwordAlgorithm,
        passwordUpdatedAt: input.at,
        failedAttemptCount: 0,
        lockedUntil: null,
      },
      select: { id: true },
    });
    const user = await this.client.user.update({
      where: { id: input.userId },
      data: { securityVersion: { increment: 1 } },
      select: { securityVersion: true },
    });
    await this.revokeActiveSessions(
      input.userId,
      input.at,
      'PASSWORD_CHANGE',
      input.excludeSessionId,
    );
    return user.securityVersion;
  }
}

export class PrismaIdentityTransactionManager implements IdentityTransactionManager {
  public constructor(private readonly client: ArenaPrismaClient) {}

  public async transaction<T>(
    operation: (repository: IdentityRepository) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.client.$transaction((transaction) =>
        operation(new PrismaIdentityRepository(transaction)),
      );
    } catch (error) {
      if (error instanceof IdentityError) throw error;
      throw persistenceError(error);
    }
  }
}

export class DisabledIdentityTransactionManager implements IdentityTransactionManager {
  public transaction<T>(operation: (repository: IdentityRepository) => Promise<T>): Promise<T> {
    void operation;
    return Promise.reject(new IdentityError('IDENTITY_DATABASE_DISABLED'));
  }
}
