import { describe, expect, it } from 'vitest';
import {
  NotificationOutboxService,
  type NotificationOutboxRecord,
  type NotificationRepository,
} from '../src';
const now = new Date('2026-01-01T00:00:00Z');
const row = (
  id: string,
  status: NotificationOutboxRecord['status'] = 'PENDING',
  availableAt = now,
): NotificationOutboxRecord => ({
  id,
  notificationId: `n-${id}`,
  channel: 'IN_APP',
  status,
  deduplicationKey: `d-${id}`,
  availableAt,
  attemptCount: 0,
  lastAttemptAt: null,
  deliveredAt: null,
  failedAt: null,
  deadLetteredAt: null,
  lastErrorCode: null,
  payloadSnapshot: { schemaVersion: 1, data: {} },
  claimToken: null,
  claimExpiresAt: null,
  version: 1,
  notification: {
    recipientUserId: 'u',
    type: 'MATCH_READY_REQUIRED',
    subject: 's',
    body: 'b',
    locale: 'fa',
  },
});
class ClaimAdapter {
  public constructor(public readonly rows: NotificationOutboxRecord[]) {}
  public async claimPendingMessages(at: Date, limit: number, lease: number, token: string) {
    const result: NotificationOutboxRecord[] = [];
    for (const item of [...this.rows].sort(
      (a, b) => a.availableAt.getTime() - b.availableAt.getTime() || a.id.localeCompare(b.id),
    )) {
      if (result.length >= limit) break;
      if (!['PENDING', 'RETRY_SCHEDULED'].includes(item.status) || item.availableAt > at) continue;
      const updated = {
        ...item,
        status: 'PROCESSING' as const,
        claimToken: token,
        claimExpiresAt: new Date(at.getTime() + lease * 1000),
        version: item.version + 1,
      };
      this.rows[this.rows.indexOf(item)] = updated;
      result.push(updated);
    }
    return result;
  }
  public async releaseExpiredClaims(at: Date, limit: number) {
    let count = 0;
    for (let index = 0; index < this.rows.length && count < limit; index++) {
      const item = this.rows[index];
      if (item?.status === 'PROCESSING' && item.claimExpiresAt && item.claimExpiresAt <= at) {
        this.rows[index] = {
          ...item,
          status: 'RETRY_SCHEDULED',
          availableAt: at,
          claimToken: null,
          claimExpiresAt: null,
          version: item.version + 1,
        };
        count++;
      }
    }
    return count;
  }
}
describe('claim concurrency semantics', () => {
  it('never returns one message to two concurrent claimants and obeys limit/order', async () => {
    const adapter = new ClaimAdapter([
      row('b'),
      row('a'),
      row('future', 'PENDING', new Date(now.getTime() + 1000)),
      row('done', 'DELIVERED'),
    ]);
    const ids = ['claim-a', 'claim-b'];
    const repo = adapter as unknown as NotificationRepository;
    const a = new NotificationOutboxService(
      repo,
      { now: () => now },
      { generate: () => ids.shift()! },
      { maxAttempts: 3, retryBaseSeconds: 1, retryMaxSeconds: 10, claimLeaseSeconds: 60 },
    );
    const [left, right] = await Promise.all([a.claim(1), a.claim(1)]);
    expect([...left, ...right].map((item) => item.id)).toEqual(['a', 'b']);
    expect(new Set([...left, ...right].map((item) => item.id)).size).toBe(2);
  });
  it('recovers only expired leases and makes them claimable again', async () => {
    const expired = {
      ...row('x'),
      status: 'PROCESSING' as const,
      claimToken: 'old',
      claimExpiresAt: new Date(now.getTime() - 1),
    };
    const active = {
      ...row('y'),
      status: 'PROCESSING' as const,
      claimToken: 'new',
      claimExpiresAt: new Date(now.getTime() + 1000),
    };
    const adapter = new ClaimAdapter([expired, active]);
    const repo = adapter as unknown as NotificationRepository;
    const service = new NotificationOutboxService(
      repo,
      { now: () => now },
      { generate: () => 'recovery' },
      { maxAttempts: 3, retryBaseSeconds: 1, retryMaxSeconds: 10, claimLeaseSeconds: 60 },
    );
    expect(await service.releaseExpiredClaims(10)).toBe(1);
    expect((await service.claim(10)).map((item) => item.id)).toEqual(['x']);
  });
});
