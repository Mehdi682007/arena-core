import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Prisma, SessionStatus, UserStatus } from '../src/generated/prisma/client';

const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma');
const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260725053000_init_identity/migration.sql',
);

const expectedModels = [
  'User',
  'UserProfile',
  'UserEmail',
  'UserPhone',
  'PhoneOtpChallenge',
  'UserMfaTotp',
  'MfaTotpRotation',
  'MfaRecoveryCode',
  'MfaLoginChallenge',
  'PasswordCredential',
  'UserSession',
  'EmailVerificationToken',
  'PasswordResetToken',
  'Role',
  'Permission',
  'UserRole',
  'RolePermission',
] as const;
const catalogModels = [
  'Game',
  'Platform',
  'GamePlatform',
  'UserGameAccount',
  'GameAccountReview',
  'CrossplayGroup',
  'CrossplayGroupPlatform',
  'GameMode',
  'GameRuleset',
  'MatchmakingRequest',
  'MatchmakingProposal',
  'Match',
  'MatchParticipant',
  'MatchAuditEvent',
  'MatchResultSubmission',
  'MatchResult',
  'MatchEvidence',
  'MatchDispute',
  'MatchDisputeResponse',
  'MatchResultRevision',
  'Wallet',
  'LedgerAccount',
  'LedgerTransaction',
  'LedgerEntry',
  'WalletAuditEvent',
  'MatchEntryReservation',
  'MatchSettlement',
  'PlayerRating',
  'MatchRatingApplication',
  'PlayerRatingChange',
  'Notification',
  'NotificationPreference',
  'NotificationOutboxMessage',
  'NotificationDeliveryAttempt',
  'AdminAuditEvent',
  'SiteSettings',
  'SiteSettingsRevision',
] as const;

const expectedTables = [
  'users',
  'user_profiles',
  'user_emails',
  'password_credentials',
  'user_sessions',
  'email_verification_tokens',
  'password_reset_tokens',
  'roles',
  'permissions',
  'user_roles',
  'role_permissions',
] as const;

describe('identity Prisma schema', () => {
  it('contains the approved Identity models alongside later bounded contexts', async () => {
    const schema = await readFile(schemaPath, 'utf8');
    const models = [...schema.matchAll(/^model\s+(\w+)\s+\{/gm)].map((match) => match[1]);

    expect(models.slice(0, expectedModels.length)).toEqual(expectedModels);
    expect(models).toEqual([...expectedModels, ...catalogModels]);
    expect(schema).not.toMatch(/\bTournament\b/);
  });

  it('stores pending TOTP rotation secrets only as sealed values', async () => {
    const schema = await readFile(schemaPath, 'utf8');
    expect(schema).toContain('model MfaTotpRotation');
    expect(schema).toContain('candidateSecretCiphertext');
    expect(schema).toContain('candidateSecretIv');
    expect(schema).toContain('candidateSecretTag');
    expect(schema).not.toMatch(
      /model MfaTotpRotation[\s\S]*?\n}\s*[\s\S]*?candidateSecret\s+String/,
    );
  });

  it('keeps raw passwords and raw tokens out of persistence', async () => {
    const schema = await readFile(schemaPath, 'utf8');

    expect(schema).not.toMatch(/^\s+(?:password|token)\s+/gm);
    expect(schema).toContain('passwordHash');
    expect(schema.match(/\btokenHash\b/g)).toHaveLength(4);
  });

  it('expresses schema-level uniqueness, mappings, indexes, and delete behavior', async () => {
    const schema = await readFile(schemaPath, 'utf8');

    expect(schema).toContain(
      '@unique(map: "user_emails_normalized_email_key") @map("normalized_email")',
    );
    expect(schema).toContain('@unique(map: "password_credentials_user_id_key") @map("user_id")');
    expect(schema).toContain('@unique(map: "user_sessions_token_hash_key") @map("token_hash")');
    expect(schema).toContain('@@index([userId, status], map: "user_sessions_user_id_status_idx")');
    expect(schema).toContain('onDelete: SetNull');
    expect(schema).toContain('onDelete: Restrict');
    expect(schema).toContain('onDelete: Cascade');
    expect(schema).toContain('@db.Timestamptz(3)');
    expect(schema).toContain('@@map("user_emails")');
  });
});

describe('init_identity migration', () => {
  it('creates exactly the approved tables', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    const tables = [...sql.matchAll(/^CREATE TABLE "([^"]+)"/gm)].map((match) => match[1]);

    expect(tables).toEqual(expectedTables);
  });

  it('enforces primary-email, non-negative, expiry, consumption, and deletion invariants', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toContain('CREATE UNIQUE INDEX "user_emails_one_primary_per_user_key"');
    expect(sql).toContain('WHERE "is_primary" = true');
    expect(sql).toContain('CONSTRAINT "users_security_version_check"');
    expect(sql).toContain('CONSTRAINT "users_deleted_state_check"');
    expect(sql).toContain('CONSTRAINT "password_credentials_failed_attempt_count_check"');
    expect(sql).toContain('CONSTRAINT "user_sessions_expiry_check"');
    expect(sql).toContain('CONSTRAINT "user_sessions_revocation_check"');
    expect(sql).toContain('CONSTRAINT "email_verification_tokens_expiry_check"');
    expect(sql).toContain('CONSTRAINT "password_reset_tokens_expiry_check"');
    expect(sql).toContain('CONSTRAINT "email_verification_tokens_consumed_check"');
    expect(sql).toContain('CONSTRAINT "password_reset_tokens_consumed_check"');
  });

  it('contains the expected indexes, foreign keys, and no secrets or fixtures', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    for (const name of [
      'user_sessions_token_hash_key',
      'user_sessions_user_id_status_idx',
      'user_sessions_expires_at_idx',
      'email_verification_tokens_token_hash_key',
      'email_verification_tokens_expires_at_idx',
      'password_reset_tokens_token_hash_key',
      'password_reset_tokens_expires_at_idx',
    ]) {
      expect(sql).toContain(`"${name}"`);
    }
    expect(sql).toContain('ON DELETE CASCADE');
    expect(sql).toContain('ON DELETE RESTRICT');
    expect(sql).toContain('ON DELETE SET NULL');
    expect(sql).not.toMatch(/postgres(?:ql)?:\/\//);
    expect(sql).not.toMatch(/INSERT\s+INTO/i);
  });
});

describe('generated Identity client', () => {
  it('exposes approved Identity and catalog model metadata and Identity enums', () => {
    expect(Object.values(Prisma.ModelName)).toEqual([...expectedModels, ...catalogModels]);
    expect(UserStatus).toMatchObject({
      PENDING_VERIFICATION: 'PENDING_VERIFICATION',
      ACTIVE: 'ACTIVE',
      SUSPENDED: 'SUSPENDED',
      DISABLED: 'DISABLED',
      DELETED: 'DELETED',
    });
    expect(SessionStatus).toMatchObject({
      ACTIVE: 'ACTIVE',
      REVOKED: 'REVOKED',
      EXPIRED: 'EXPIRED',
    });
  });
});
