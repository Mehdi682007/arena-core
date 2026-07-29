import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(__dirname, '../prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(__dirname, '../prisma/migrations/20260725203000_create_user_game_accounts/migration.sql'),
  'utf8',
);
describe('player identity schema and migration', () => {
  it('defines account, review, conservative enums, and relations', () => {
    expect(schema).toContain('model UserGameAccount');
    expect(schema).toContain('model GameAccountReview');
    expect(schema).toMatch(/enum GameAccountVerificationMethod[\s\S]*UNVERIFIED[\s\S]*MANUAL/);
    expect(schema).not.toMatch(/accessToken|refreshToken|password.*UserGameAccount/i);
  });
  it('enforces cross-game platform consistency with a composite FK', () => {
    expect(migration).toContain(
      'FOREIGN KEY ("game_platform_id", "game_id") REFERENCES "game_platforms"("id", "game_id")',
    );
  });
  it('contains all three partial unique indexes', () => {
    expect(migration).toContain('user_game_accounts_primary_user_game_key');
    expect(migration).toContain('user_game_accounts_active_user_platform_key');
    expect(migration).toContain('user_game_accounts_active_platform_handle_key');
    expect(migration.match(/CREATE UNIQUE INDEX/g)).toHaveLength(3);
  });
  it('enforces primary and lifecycle timestamp checks', () => {
    expect(migration).toContain('user_game_accounts_primary_verified_check');
    expect(migration).toContain('user_game_accounts_status_timestamps_check');
  });
  it('creates append-only review storage without update/delete SQL', () => {
    expect(migration).toContain('CREATE TABLE "game_account_reviews"');
    expect(migration).not.toMatch(
      /UPDATE "game_account_reviews"|DELETE FROM "game_account_reviews"/,
    );
  });
});
