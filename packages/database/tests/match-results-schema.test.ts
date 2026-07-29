import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve('prisma/migrations/20260726180000_create_match_results/migration.sql'),
  'utf8',
);

describe('F4.3 match result schema', () => {
  it('extends lifecycle and adds result models', () => {
    expect(schema).toMatch(
      /IN_PROGRESS[\s\S]*AWAITING_RESULT[\s\S]*RESULT_CONFLICT[\s\S]*COMPLETED/,
    );
    expect(schema).toMatch(/model MatchResultSubmission \{/);
    expect(schema).toMatch(/model MatchResult \{/);
  });
  it('has active submission, unique result and outcome constraints', () => {
    expect(migration).toContain('match_result_submissions_active_participant_key');
    expect(migration).toContain('match_results_match_id_key');
    expect(migration).toContain('match_results_outcome_check');
    expect(migration).toContain('match_results_winner_match_fkey');
  });
  it('keeps prohibited future domains absent', () => {
    expect(schema).not.toMatch(/^model Rating\b/m);
    expect(migration).not.toMatch(
      /CREATE TABLE "(?:match_evidence|match_disputes|wallet|ratings)/i,
    );
  });
});
