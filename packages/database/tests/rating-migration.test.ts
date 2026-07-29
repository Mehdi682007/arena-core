import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const sql = readFileSync(
  join(process.cwd(), 'prisma/migrations/20260729120000_create_player_ratings/migration.sql'),
  'utf8',
);

describe('rating migration', () => {
  it('defines rating, immutable changes, applications and enums', () => {
    expect(schema).toContain('model PlayerRating');
    expect(schema).toContain('model PlayerRatingChange');
    expect(schema).toContain('model MatchRatingApplication');
    expect(schema).toContain('enum RatingOutcome');
    expect(schema).toContain('enum MatchRatingApplicationStatus');
  });

  it('enforces scope, idempotency, bounds, statistics and history equations', () => {
    expect(sql).toContain('player_ratings_scope_key');
    expect(sql).toContain('match_rating_applications_idempotency_key');
    expect(sql).toContain('player_rating_changes_match_user_key');
    expect(sql).toContain('"rating_after" = "rating_before" + "rating_delta"');
    expect(sql).toContain('"wins" + "losses" + "draws" = "matches_played"');
    expect(sql).toContain('jsonb_typeof("calculation_snapshot") = \'object\'');
  });

  it('has no financial, reward, tournament, queue or season model', () => {
    expect(sql).not.toMatch(/\b(wallet|reward|prize|tournament|bullmq|redis|season_reward)\b/i);
  });
});
