import { describe, expect, it, vi } from 'vitest';
import {
  NotificationCoordinator,
  type CreateNotificationInput,
  type NotificationService,
} from '../src';

const forbidden =
  /opponentUserId|opponentEmail|normalizedHandle|userGameAccountId|walletId|ledgerAccountId|escrowAccountId|"(?:submission|evidence)[^"]*"|reviewerUserId|adminNote|idempotencyKey|requestFingerprint|providerError|session|token|password|(?:^|")ip/i;
function harness(fail = false) {
  const created: CreateNotificationInput[] = [];
  const service = {
    create: vi.fn(async (input: CreateNotificationInput) => {
      if (fail) throw new Error('database-url-and-provider-secret');
      created.push(input);
      return { id: 'n1' };
    }),
  } as unknown as NotificationService;
  const failures: unknown[] = [];
  return {
    coordinator: new NotificationCoordinator(service, {
      record: (item) => {
        failures.push(item);
      },
    }),
    created,
    failures,
  };
}
describe('production notification integration coordinator', () => {
  it('builds safe payloads for all eight mandatory events', async () => {
    const h = harness();
    await h.coordinator.proposalCreated({
      recipients: ['a', 'b'],
      proposalId: 'p1',
      eventVersion: 1,
      game: 'FC 26',
      mode: '1v1',
      expiration: '2026-01-01',
      state: 'PENDING',
    });
    await h.coordinator.matchReady({
      recipients: ['a', 'b'],
      matchId: 'm1',
      eventVersion: 1,
      game: 'FC 26',
      mode: '1v1',
      readyDeadlineAt: '2026-01-01',
    });
    await h.coordinator.result({
      recipients: ['a', 'b'],
      matchId: 'm1',
      resultId: 'r1',
      eventVersion: 1,
      status: 'CONFIRMED',
      summary: '2-1',
    });
    await h.coordinator.result({
      recipients: ['a', 'b'],
      matchId: 'm2',
      resultId: 'r2',
      eventVersion: 1,
      status: 'CONFLICT',
      summary: 'conflict',
      nextAction: 'submit evidence',
    });
    await h.coordinator.disputeOpened({
      recipientUserId: 'b',
      disputeId: 'd1',
      matchId: 'm1',
      eventVersion: 1,
      status: 'AWAITING_RESPONSE',
      responseDeadline: '2026-01-01',
      reasonCategory: 'SCORE',
    });
    await h.coordinator.disputeResolved({
      recipients: ['a', 'b'],
      disputeId: 'd1',
      matchId: 'm1',
      eventVersion: 2,
      resolution: 'UPHELD',
      resolvedAt: '2026-01-02',
    });
    await h.coordinator.settlementCompleted({
      settlementId: 's1',
      matchId: 'm1',
      eventVersion: 1,
      settlementType: 'WINNER_TAKES_ALL',
      recipients: [
        { userId: 'a', ownAmount: '200' },
        { userId: 'b', ownAmount: '0' },
      ],
    });
    await h.coordinator.ratingUpdated({
      applicationId: 'ra1',
      eventVersion: 1,
      game: 'FC 26',
      mode: '1v1',
      recipients: [
        { userId: 'a', ratingBefore: 1000, ratingAfter: 1020, ratingDelta: 20, outcome: 'WIN' },
        { userId: 'b', ratingBefore: 1000, ratingAfter: 980, ratingDelta: -20, outcome: 'LOSS' },
      ],
    });
    expect(new Set(h.created.map((item) => item.type))).toEqual(
      new Set([
        'MATCHMAKING_PROPOSAL_CREATED',
        'MATCH_READY_REQUIRED',
        'MATCH_RESULT_CONFIRMED',
        'MATCH_RESULT_CONFLICT',
        'MATCH_DISPUTE_OPENED',
        'MATCH_DISPUTE_RESOLVED',
        'MATCH_SETTLEMENT_COMPLETED',
        'RATING_UPDATED',
      ]),
    );
    for (const item of h.created) expect(JSON.stringify(item.payload)).not.toMatch(forbidden);
    expect(
      h.created
        .filter((item) => item.type === 'MATCH_DISPUTE_OPENED')
        .map((item) => item.recipientUserId),
    ).toEqual(['b']);
    const settlements = h.created.filter((item) => item.type === 'MATCH_SETTLEMENT_COMPLETED');
    expect(settlements[0]?.payload.data.amount).toBe('200');
    expect(settlements[1]?.payload.data.amount).toBe('0');
  });
  it('isolates failures, records sanitized recovery metadata and preserves callers', async () => {
    const h = harness(true);
    const result = await h.coordinator.matchReady({
      recipients: ['a', 'b'],
      matchId: 'm1',
      eventVersion: 1,
      game: 'FC 26',
      mode: '1v1',
      readyDeadlineAt: '2026-01-01',
    });
    expect(result.every((item) => item.status === 'rejected')).toBe(true);
    expect(h.failures).toHaveLength(2);
    expect(JSON.stringify(h.failures)).not.toMatch(/database-url|provider-secret/);
  });
});
