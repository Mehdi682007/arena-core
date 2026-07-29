import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(__dirname, '../prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(
    __dirname,
    '../prisma/migrations/20260725220000_create_matchmaking_requests/migration.sql',
  ),
  'utf8',
);
describe('matchmaking schema and migration', () => {
  it('defines request/proposal models and approved enums alongside later matches', () => {
    expect(schema).toContain('model MatchmakingRequest');
    expect(schema).toContain('model MatchmakingProposal');
    expect(schema).toContain('enum MatchmakingRequestStatus');
    expect(schema).toContain('enum MatchmakingProposalStatus');
    expect(schema).toContain('enum MatchmakingSearchScope');
    expect(schema).toMatch(/^model Match\s/m);
  });
  it('enforces account and catalog consistency through composite foreign keys', () => {
    expect(migration).toContain('matchmaking_requests_account_identity_fkey');
    expect(migration).toContain('matchmaking_requests_ruleset_game_mode_fkey');
    expect(migration).toContain('matchmaking_requests_crossplay_game_fkey');
  });
  it('enforces active request, pair and active proposal policies', () => {
    expect(migration).toContain('matchmaking_requests_one_active_user_key');
    expect(migration).toContain('matchmaking_proposals_active_pair_key');
    expect(migration).toContain('matchmaking_proposals_canonical_pair_check');
    expect(migration).toContain('matchmaking_proposals_one_active_request_trigger');
    expect(migration).toContain('pg_advisory_xact_lock');
  });
  it('contains expiry, version, priority, status and acceptance checks', () => {
    for (const name of [
      'matchmaking_requests_expiry_check',
      'matchmaking_requests_priority_check',
      'matchmaking_requests_version_check',
      'matchmaking_requests_status_timestamps_check',
      'matchmaking_proposals_expiry_check',
      'matchmaking_proposals_version_check',
      'matchmaking_proposals_acceptance_check',
      'matchmaking_proposals_rejection_check',
    ])
      expect(migration).toContain(name);
  });
  it('has bounded candidate indexes and no queue, seed, wallet or financial columns', () => {
    expect(migration).toContain('matchmaking_requests_candidate_idx');
    expect(migration).not.toMatch(/CREATE TABLE "(?:queues?|matches?|wallets?)"/i);
    expect(migration).not.toMatch(/INSERT\s+INTO|entry_fee|prize|rating|skill/i);
  });
});
