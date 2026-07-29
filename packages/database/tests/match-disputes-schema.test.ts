import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve('prisma/migrations/20260726220000_create_match_evidence_and_disputes/migration.sql'),
  'utf8',
);

describe('F4.4 match evidence and dispute schema', () => {
  it('defines evidence, dispute, response and append-only result revision models', () => {
    for (const model of [
      'MatchEvidence',
      'MatchDispute',
      'MatchDisputeResponse',
      'MatchResultRevision',
    ])
      expect(schema).toContain(`model ${model} {`);
    expect(schema).toMatch(/enum MatchEvidenceStatus[\s\S]*ACTIVE[\s\S]*WITHDRAWN[\s\S]*LOCKED/);
    expect(schema).toMatch(/enum MatchDisputeStatus[\s\S]*AWAITING_RESPONSE[\s\S]*UNDER_REVIEW/);
  });

  it('contains ownership, active-dispute, response and revision constraints', () => {
    expect(migration.length).toBeGreaterThan(8_000);
    expect(migration).toContain('match_evidence_owner_fkey');
    expect(migration).toContain('match_disputes_one_active_match_key');
    expect(migration).toContain('match_dispute_responses_dispute_id_key');
    expect(migration).toContain('match_result_revisions_dispute_id_key');
    expect(migration).toContain('match_disputes_resolution_check');
    expect(migration).toContain('match_disputes_claim_object_check');
  });

  it('adds no storage, financial, rating or notification persistence', () => {
    expect(schema).not.toMatch(/^model (?:File|ObjectStorage|Rating|NotificationJob)\b/m);
    expect(migration).not.toMatch(/(?:storage_key|external_url|mime_type|checksum|wallet|rating)/i);
  });
});
