import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve('src/infrastructure/prisma-rating-repository.ts'), 'utf8');

describe('Prisma rating adapter', () => {
  it('uses explicit selects, final-result and active-dispute queries', () => {
    expect(source).toContain('const ratingSelect');
    expect(source).toContain('const applicationSelect');
    expect(source).toContain("status: { in: ['CONFIRMED', 'ADMIN_RESOLVED'] }");
    expect(source).toContain("status: { in: ['OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW'] }");
    expect(source).not.toMatch(/include:\s*\{/);
  });

  it('locks ratings deterministically and writes both current and history state', () => {
    expect(source).toContain('.sort()');
    expect(source).toContain('ORDER BY id FOR UPDATE');
    expect(source).toContain('playerRating.updateMany');
    expect(source).toContain('playerRatingChange.create');
    expect(source).toContain('matchRatingApplication.create');
  });

  it('orders the leaderboard and keeps sensitive identity fields out', () => {
    expect(source).toContain("{ rating: 'desc' }");
    expect(source).toContain("{ matchesPlayed: 'desc' }");
    expect(source).toContain("{ wins: 'desc' }");
    expect(source).toContain("{ updatedAt: 'asc' }");
    expect(source).not.toMatch(/passwordHash|normalizedEmail|normalizedHandle|wallet/);
  });
});
