import { describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { InMemoryEmailSender } from '@arena-core/email';
import { IdentityEmailDispatcher } from '../dist/identity/email/identity-email-dispatcher.js';
import { EmailLifecycleService } from '../dist/email/email-lifecycle.service.js';

function emailConfig(extra = {}) {
  return createApiConfig(
    {
      NODE_ENV: 'test',
      DATABASE_ENABLED: 'false',
      SMTP_ENABLED: 'true',
      SMTP_FROM_ADDRESS: 'identity@example.test',
      IDENTITY_PUBLIC_BASE_URL: 'https://arena.example.test',
      IDENTITY_EMAIL_DELIVERY_REQUIRED: 'true',
      ...extra,
    },
    { packageVersion: '2.4.0', actualNodeVersion: process.versions.node },
  );
}

describe('identity email integration', () => {
  it('dispatches verification and reset messages with encoded opaque tokens', async () => {
    const sender = new InMemoryEmailSender();
    const dispatcher = new IdentityEmailDispatcher(emailConfig(), sender);

    await dispatcher.sendVerificationEmail({
      email: 'player@example.test',
      token: 'verify +/?&=token',
      expiresAt: new Date('2030-01-02T03:04:05.000Z'),
      locale: 'fa',
      recipientName: '<Player>',
    });
    await dispatcher.sendPasswordResetEmail({
      email: 'player@example.test',
      token: 'reset +/?&=token',
      expiresAt: new Date('2030-01-02T03:04:05.000Z'),
      locale: 'en',
    });

    expect(sender.messages).toHaveLength(2);
    expect(sender.messages[0].html).toContain('lang="fa" dir="rtl"');
    expect(sender.messages[0].html).toContain('%2B%2F%3F%26%3Dtoken');
    expect(sender.messages[0].html).not.toContain('<Player>');
    expect(sender.messages[0].subject).not.toContain('verify +/?&=token');
    expect(sender.messages[1].html).toContain('lang="en" dir="ltr"');
    expect(sender.messages[1].html).toContain('%2B%2F%3F%26%3Dtoken');
  });

  it('verifies required delivery at startup and closes the sender at shutdown', async () => {
    const sender = { send: vi.fn(), verify: vi.fn(), close: vi.fn() };
    const lifecycle = new EmailLifecycleService(emailConfig(), sender);

    await lifecycle.onModuleInit();
    lifecycle.onModuleDestroy();

    expect(sender.verify).toHaveBeenCalledOnce();
    expect(sender.close).toHaveBeenCalledOnce();
  });

  it('does not probe optional delivery during startup', async () => {
    const sender = { send: vi.fn(), verify: vi.fn(), close: vi.fn() };
    const lifecycle = new EmailLifecycleService(
      emailConfig({ IDENTITY_EMAIL_DELIVERY_REQUIRED: 'false' }),
      sender,
    );

    await lifecycle.onModuleInit();

    expect(sender.verify).not.toHaveBeenCalled();
  });
});
