import { describe, expect, it, vi } from 'vitest';
import { EmailError } from '@arena-core/email';
import { EmailPackageNotificationAdapter } from '../src';
const input = {
  recipientUserId: 'u1',
  subject: 'Subject',
  text: 'Body',
  html: '<p>Body</p>',
  deduplicationKey: 'dedup-1',
};
function adapter(email: string | null, sender: unknown) {
  const client = { userEmail: { findFirst: vi.fn(async () => (email ? { email } : null)) } };
  return {
    value: new EmailPackageNotificationAdapter(client as never, sender as never, {
      address: 'no-reply@arena.test',
    }),
    client,
  };
}
describe('email package notification adapter', () => {
  it('sends only to verified primary lookup and forwards dedup key', async () => {
    const sender = { send: vi.fn(async () => ({ messageId: 'provider-id' })) };
    const h = adapter('verified@arena.test', sender);
    expect(await h.value.send(input)).toEqual({
      status: 'SENT',
      provider: 'EMAIL_PACKAGE',
      providerMessageId: 'provider-id',
    });
    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-Arena-Idempotency-Key': 'dedup-1' },
      }),
    );
    expect(h.client.userEmail.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'u1',
          isPrimary: true,
          verifiedAt: { not: null },
          user: { status: 'ACTIVE', deletedAt: null },
        },
      }),
    );
  });
  it('skips missing or unverified recipient without a network call', async () => {
    const sender = { send: vi.fn() };
    expect(await adapter(null, sender).value.send(input)).toMatchObject({
      status: 'SKIPPED',
      errorCode: 'EMAIL_UNVERIFIED',
    });
    expect(sender.send).not.toHaveBeenCalled();
  });
  it('maps provider failures without retaining raw exception text', async () => {
    const permanent = adapter('a@b.test', {
      send: async () => {
        throw new EmailError('EMAIL_DELIVERY_REJECTED');
      },
    });
    const retryable = adapter('a@b.test', {
      send: async () => {
        throw new Error('smtp password=secret raw response');
      },
    });
    expect(JSON.stringify(await permanent.value.send(input))).toBe(
      '{"status":"PERMANENT_FAILURE","provider":"EMAIL_PACKAGE","errorCode":"EMAIL_DELIVERY_REJECTED"}',
    );
    expect(JSON.stringify(await retryable.value.send(input))).toBe(
      '{"status":"RETRYABLE_FAILURE","provider":"EMAIL_PACKAGE","errorCode":"EMAIL_DELIVERY_UNAVAILABLE"}',
    );
  });
});
