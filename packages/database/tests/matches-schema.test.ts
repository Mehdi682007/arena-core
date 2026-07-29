import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma');
const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260726120000_create_matches/migration.sql',
);
describe('F4.2 matches schema and migration', () => {
  it('defines conservative lifecycle, participants, snapshots and audit', async () => {
    const schema = await readFile(schemaPath, 'utf8');
    expect(schema).toMatch(/enum MatchStatus[\s\S]*AWAITING_READY[\s\S]*VOIDED/);
    expect(schema).toMatch(/model Match \{/);
    expect(schema).toMatch(/model MatchParticipant \{/);
    expect(schema).toMatch(/model MatchAuditEvent \{/);
    expect(schema).toContain('@unique(map: "matches_proposal_id_key")');
    expect(schema).toContain('@@unique([matchId, side]');
    expect(schema).toContain('@@unique([matchId, userId]');
  });
  it('contains real SQL checks, indexes, ownership keys and audit foreign keys', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql.length).toBeGreaterThan(5_000);
    expect(sql).toContain('matches_ready_deadline_check');
    expect(sql).toContain('matches_snapshot_version_check');
    expect(sql).toContain('match_participants_account_identity_fkey');
    expect(sql).toContain('matches_status_ready_deadline_idx');
    expect(sql).toContain('match_audit_events_admin_void_reason_check');
  });
  it('keeps F4.1 trigger untouched and adds no entry fee or prize model', async () => {
    const [schema, prior] = await Promise.all([
      readFile(schemaPath, 'utf8'),
      readFile(
        resolve(
          process.cwd(),
          'prisma/migrations/20260725220000_create_matchmaking_requests/migration.sql',
        ),
        'utf8',
      ),
    ]);
    expect(prior).toContain('matchmaking_proposals_one_active_request_trigger');
    expect(schema).not.toMatch(/entryFee|prize/i);
  });
});
