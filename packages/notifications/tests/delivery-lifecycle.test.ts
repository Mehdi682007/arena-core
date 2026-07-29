/* eslint-disable @typescript-eslint/no-unsafe-return -- typed transition test adapter. */
import { describe, expect, it, vi } from 'vitest';
import {
  NotificationDeliveryService,
  retryDelaySeconds,
  type NotificationEmailDeliveryResult,
  type NotificationOutboxRecord,
  type NotificationRepository,
} from '../src';
const now = new Date('2026-01-01T00:00:00.000Z');
const base: NotificationOutboxRecord = {
  id: 'o1',
  notificationId: 'n1',
  channel: 'EMAIL',
  status: 'PENDING',
  deduplicationKey: 'd1',
  availableAt: now,
  attemptCount: 0,
  lastAttemptAt: null,
  deliveredAt: null,
  failedAt: null,
  deadLetteredAt: null,
  lastErrorCode: null,
  payloadSnapshot: { schemaVersion: 1, data: { game: 'FC 26', rating: 1020, delta: 20 } },
  claimToken: null,
  claimExpiresAt: null,
  version: 1,
  notification: {
    recipientUserId: 'u1',
    type: 'RATING_UPDATED',
    subject: 's',
    body: 'b',
    locale: 'en',
  },
};
function repository(message: NotificationOutboxRecord = base) {
  const attempts: unknown[] = [];
  const transitions: string[] = [];
  const repo = {
    findOutboxMessage: vi.fn(async () => message),
    findPreference: vi.fn(async () => ({ emailEnabled: true, inAppEnabled: true })),
    appendDeliveryAttempt: vi.fn(async (input) => {
      attempts.push(input);
      return input;
    }),
    markDelivered: vi.fn(async () => {
      transitions.push('DELIVERED');
      return { ...message, status: 'DELIVERED' };
    }),
    scheduleRetry: vi.fn(async () => {
      transitions.push('RETRY_SCHEDULED');
      return { ...message, status: 'RETRY_SCHEDULED' };
    }),
    markDeadLettered: vi.fn(async () => {
      transitions.push('DEAD_LETTERED');
      return { ...message, status: 'DEAD_LETTERED' };
    }),
    cancelOutbox: vi.fn(async () => {
      transitions.push('CANCELLED');
      return { ...message, status: 'CANCELLED' };
    }),
  } as unknown as NotificationRepository;
  return { repo, attempts, transitions };
}
const policy = {
  maxAttempts: 3,
  retryBaseSeconds: 60,
  retryMaxSeconds: 100,
  claimLeaseSeconds: 60,
};
describe('delivery lifecycle', () => {
  it.each([
    ['PENDING', 'SENT', 'DELIVERED'],
    ['RETRY_SCHEDULED', 'SENT', 'DELIVERED'],
    ['PENDING', 'RETRYABLE_FAILURE', 'RETRY_SCHEDULED'],
    ['RETRY_SCHEDULED', 'RETRYABLE_FAILURE', 'RETRY_SCHEDULED'],
    ['PENDING', 'PERMANENT_FAILURE', 'DEAD_LETTERED'],
    ['RETRY_SCHEDULED', 'PERMANENT_FAILURE', 'DEAD_LETTERED'],
  ] as const)('%s plus %s transitions to %s', async (status, result, expected) => {
    const h = repository({ ...base, status });
    const email = {
      send: vi.fn(async (): Promise<NotificationEmailDeliveryResult> =>
        result === 'SENT'
          ? { status: 'SENT', provider: 'TEST' }
          : { status: result, provider: 'TEST', errorCode: 'REDACTED' },
      ),
    };
    await new NotificationDeliveryService(
      h.repo,
      email,
      { now: () => now },
      { generate: () => 'a1' },
      policy,
    ).deliverOutboxMessage('o1');
    expect(h.transitions).toEqual([expected]);
    expect(h.attempts).toHaveLength(1);
  });
  it('cancels when preference changes after creation without calling email', async () => {
    const h = repository();
    vi.mocked(h.repo.findPreference).mockResolvedValueOnce({
      id: 'p',
      userId: 'u1',
      type: 'RATING_UPDATED',
      inAppEnabled: true,
      emailEnabled: false,
      version: 2,
      createdAt: now,
      updatedAt: now,
    });
    const email = { send: vi.fn() };
    await new NotificationDeliveryService(
      h.repo,
      email,
      { now: () => now },
      { generate: () => 'a1' },
      policy,
    ).deliverOutboxMessage('o1');
    expect(h.transitions).toEqual(['CANCELLED']);
    expect(email.send).not.toHaveBeenCalled();
  });
  it('dead-letters retry exhaustion and rejects terminal redelivery', async () => {
    const h = repository({ ...base, attemptCount: 2 });
    await new NotificationDeliveryService(
      h.repo,
      { send: async () => ({ status: 'RETRYABLE_FAILURE', provider: 'TEST', errorCode: 'SAFE' }) },
      { now: () => now },
      { generate: () => 'a3' },
      policy,
    ).deliverOutboxMessage('o1');
    expect(h.transitions).toEqual(['DEAD_LETTERED']);
    const terminal = repository({ ...base, status: 'DELIVERED' });
    await expect(
      new NotificationDeliveryService(
        terminal.repo,
        { send: vi.fn() },
        { now: () => now },
        { generate: () => 'x' },
        policy,
      ).deliverOutboxMessage('o1'),
    ).rejects.toThrow(/NOTIFICATION_OUTBOX_STATE_INVALID/);
  });
  it('uses deterministic capped exponential backoff without jitter', () => {
    expect(retryDelaySeconds(policy, 1)).toBe(60);
    expect(retryDelaySeconds(policy, 2)).toBe(100);
    expect(retryDelaySeconds(policy, 9)).toBe(100);
  });
});
