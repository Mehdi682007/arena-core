import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { notificationMatchHref, statusLabel } from '../src/features/competition/presentation';
const root = path.resolve(import.meta.dirname, '..');
describe('competition presentation and security', () => {
  it('maps lifecycle states without inventing transitions', () => {
    expect(statusLabel('AWAITING_READY')).toBe('منتظر آمادگی');
    expect(statusLabel('RESULT_CONFLICT')).toBe('تضاد نتیجه');
    expect(statusLabel('UNKNOWN')).toBe('وضعیت نامشخص');
  });
  it('builds only allowlisted notification deep links', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(notificationMatchHref('MATCH_READY_REQUIRED', { matchId: id })).toBe(`/matches/${id}`);
    expect(notificationMatchHref('MATCH_RESULT_CONFLICT', { matchId: id })).toBe(
      `/matches/${id}/result`,
    );
    expect(notificationMatchHref('MATCH_READY_REQUIRED', { matchId: '../admin' })).toBeNull();
  });
  it('keeps upload, realtime, payment and private projections out of competition UI', () => {
    const files = [
      'src/features/competition/result-form.tsx',
      'src/app/(app)/matches/[matchId]/page.tsx',
      'src/features/competition/matchmaking-form.tsx',
      'src/features/competition/countdown.tsx',
    ]
      .map((file) => readFileSync(path.join(root, file), 'utf8'))
      .join('\n');
    expect(files).not.toMatch(
      /type=["']file|WebSocket|EventSource|walletId|ledgerTransactionId|normalizedHandle|opponentUserId|dangerouslySetInnerHTML/i,
    );
    expect(files).toContain('ARENA_POINT');
  });
  it('shows an accessible proposal countdown and match-scoped rating history', () => {
    const proposal = readFileSync(
      path.join(root, 'src/app/(app)/matchmaking/proposals/page.tsx'),
      'utf8',
    );
    const match = readFileSync(path.join(root, 'src/app/(app)/matches/[matchId]/page.tsx'), 'utf8');
    expect(proposal).toContain('<Countdown expiresAt={proposal.expiresAt} />');
    expect(match).toContain('/history?limit=50');
    expect(match).toContain('ratingDelta');
  });
  it('uses the public FC 26 slugs for leaderboard requests and filters', () => {
    const leaderboard = readFileSync(
      path.join(root, 'src/app/(public)/leaderboards/page.tsx'),
      'utf8',
    );
    expect(leaderboard).toContain('/leaderboards/fc-26/${mode}');
    expect(leaderboard).toContain("query.mode === 'two-v-two'");
    expect(leaderboard).toContain('<option value="one-v-one">');
    expect(leaderboard).toContain('<option value="two-v-two">');
    expect(leaderboard).not.toMatch(/ea_sports_fc_26|one_v_one|two_v_two/);
  });
});
