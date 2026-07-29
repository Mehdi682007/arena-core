/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/restrict-template-expressions -- typed rollback test adapter. */
import { describe, expect, it, vi } from 'vitest';
import { NotificationService, type NotificationRecord, type NotificationRepository } from '../src';
const now = new Date('2026-01-01T00:00:00Z');
function setup(
  options: { email?: boolean; existing?: NotificationRecord; failOutbox?: boolean } = {},
) {
  const committed: { notification?: NotificationRecord; channels?: readonly string[] } = {};
  const working: { notification?: NotificationRecord; channels?: readonly string[] } = {};
  const repo = {
    recipientExists: vi.fn(async () => true),
    findByDeduplicationKey: vi.fn(async () => options.existing ?? null),
    findPreference: vi.fn(async () => ({
      emailEnabled: options.email ?? true,
      inAppEnabled: true,
    })),
    createNotificationWithOutbox: vi.fn(async (input) => {
      working.notification = input.notification;
      working.channels = input.channels;
      if (options.failOutbox) throw new Error('outbox insert failed');
      return input.notification;
    }),
  } as unknown as NotificationRepository;
  const tx = {
    transaction: async <T>(operation: (value: NotificationRepository) => Promise<T>) => {
      try {
        const value = await operation(repo);
        Object.assign(committed, working);
        return value;
      } catch (error) {
        delete working.notification;
        delete working.channels;
        throw error;
      }
    },
  };
  let sequence = 0;
  const service = new NotificationService(
    repo,
    tx,
    { now: () => now },
    { generate: () => `id-${++sequence}` },
  );
  const input = {
    recipientUserId: 'u1',
    type: 'RATING_UPDATED' as const,
    schemaVersion: 1 as const,
    sourceType: 'RATING_APPLICATION' as const,
    sourceId: 'r1',
    eventVersion: 1,
    payload: { schemaVersion: 1 as const, data: { game: 'FC 26', rating: 1020, delta: 20 } },
  };
  return { service, input, repo, committed };
}
describe('notification creation atomicity', () => {
  it('commits notification with deterministic IN_APP/EMAIL channels together', async () => {
    const h = setup({ email: true });
    await h.service.create(h.input);
    expect(h.committed.notification?.sourceId).toBe('r1');
    expect(h.committed.channels).toEqual(['IN_APP', 'EMAIL']);
  });
  it('rolls the entire unit back when outbox creation fails', async () => {
    const h = setup({ failOutbox: true });
    await expect(h.service.create(h.input)).rejects.toThrow('outbox insert failed');
    expect(h.committed).toEqual({});
  });
  it('returns exact dedup retry and rejects same key with different payload', async () => {
    const first = setup();
    await first.service.create(first.input);
    const record = first.committed.notification!;
    const exact = setup({ existing: record });
    expect(await exact.service.create(exact.input)).toMatchObject({ type: 'RATING_UPDATED' });
    const conflict = setup({ existing: { ...record, payloadHash: 'different' } });
    await expect(conflict.service.create(conflict.input)).rejects.toThrow(
      /NOTIFICATION_DEDUPLICATION_CONFLICT/,
    );
  });
  it('resolves email preference before channel creation', async () => {
    const h = setup({ email: false });
    await h.service.create(h.input);
    expect(h.committed.channels).toEqual(['IN_APP']);
  });
});
