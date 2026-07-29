import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  join(root, 'prisma/migrations/20260727180000_create_match_entry_reservations/migration.sql'),
  'utf8',
);

describe('match finance schema and migration', () => {
  it('defines reservation persistence and minimal enum extensions', () => {
    expect(schema).toContain('model MatchEntryReservation');
    expect(schema).toContain('MATCH_ESCROW');
    expect(schema).toContain('MATCH_ENTRY_RESERVATION');
    expect(schema).toContain('MATCH_ENTRY_REFUND');
    expect(migration).toContain('CREATE TABLE "match_entry_reservations"');
  });
  it('enforces ownership, uniqueness, snapshots, and non-negative amounts', () => {
    expect(migration).toContain('"match_id", "participant_id"');
    expect(migration).toContain('participant_match_fkey');
    expect(migration).toContain('"amount" >= 0');
    expect(migration).toContain('jsonb_typeof("requirement_snapshot")');
    expect(migration).toContain('"asset_code" = \'ARENA_POINT\'');
  });
  it('contains no payout, fee, provider, fiat, or crypto model', () => {
    expect(migration).not.toMatch(/prize|payout|platform_fee|payment_provider|fiat|crypto/i);
  });
});
