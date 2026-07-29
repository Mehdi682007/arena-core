import { describe, expect, it, vi } from 'vitest';
import {
  buildPasswordResetUrl,
  buildVerificationUrl,
  createEmailMessage,
  EmailError,
  IdentityEmailTemplateRenderer,
  InMemoryEmailSender,
  maskEmailAddress,
  SmtpEmailSender,
  type SmtpTransport,
} from '../src';

describe('email message safety', () => {
  const base = {
    to: { address: 'player@example.com', name: 'کاربر نمونه' },
    from: { address: 'no-reply@arena-core.local', name: 'Arena Core' },
    subject: 'Safe subject',
    text: 'Text body',
    html: '<p>HTML body</p>',
  };

  it('creates an immutable transport-neutral message', () => {
    const message = createEmailMessage(base);
    expect(message).toEqual(base);
    expect(Object.isFrozen(message)).toBe(true);
    expect(Object.isFrozen(message.to)).toBe(true);
  });

  it.each([
    { ...base, subject: 'Injected\r\nBcc: victim@example.com' },
    { ...base, to: { address: 'a@example.com\r\nBcc:x@example.com' } },
    { ...base, headers: { 'X-Safe\r\nBcc': 'value' } },
    { ...base, headers: { 'X-Safe': 'value\r\nBcc: x@example.com' } },
  ])('rejects header injection', (message) => {
    expect(() => createEmailMessage(message)).toThrow(EmailError);
  });

  it('masks addresses without changing identity normalization', () => {
    expect(maskEmailAddress('u@example.com')).toBe('u***@example.com');
    expect(maskEmailAddress('کاربر@example.com')).toBe('ک***@example.com');
    expect(maskEmailAddress('invalid')).toBe('***');
  });
});

describe('identity URL builder', () => {
  it('encodes reserved token characters with URLSearchParams', () => {
    const value = buildVerificationUrl('https://app.example.com/base', '/verify-email', 'a+b/c=_-');
    const url = new URL(value);
    expect(url.origin).toBe('https://app.example.com');
    expect(url.pathname).toBe('/verify-email');
    expect(url.searchParams.get('token')).toBe('a+b/c=_-');
  });

  it.each([
    ['javascript:alert(1)', '/verify', 'token'],
    ['https://app.example.com?next=x', '/verify', 'token'],
    ['https://app.example.com#fragment', '/verify', 'token'],
    ['https://app.example.com', '//evil.example/path', 'token'],
    ['https://app.example.com', 'https://evil.example/path', 'token-secret'],
  ])('rejects unsafe URL inputs without echoing tokens', (base, path, token) => {
    try {
      buildPasswordResetUrl(base, path, token);
      throw new Error('expected URL rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(EmailError);
      expect(String(error)).not.toContain(token);
    }
  });
});

describe('identity templates', () => {
  const renderer = new IdentityEmailTemplateRenderer('Arena Core');
  const url = 'https://app.example.com/verify-email?token=opaque-token';
  const expiresAt = new Date('2026-07-26T10:30:00.000Z');

  it.each([
    ['fa' as const, 'rtl', 'تأیید ایمیل حساب Arena Core'],
    ['en' as const, 'ltr', 'Verify your Arena Core email'],
  ])('renders verification %s safely', (locale, direction, subject) => {
    const rendered = renderer.renderVerificationEmail({
      locale,
      recipientName: '<script>alert(1)</script>',
      verificationUrl: url,
      expiresAt,
    });
    expect(rendered.subject).toBe(subject);
    expect(rendered.html).toContain(`lang="${locale}"`);
    expect(rendered.html).toContain(`dir="${direction}"`);
    expect(rendered.html).toContain('&lt;script&gt;');
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).not.toContain('<form');
    expect(rendered.html).not.toContain('<img');
    expect(rendered.text).toContain(url);
    expect(rendered.text).toContain(locale === 'fa' ? '۱۴۰۵' : '2026');
    expect(rendered.text).toContain('UTC');
    expect(
      renderer.renderVerificationEmail({
        locale,
        verificationUrl: url,
        expiresAt,
        recipientName: '<script>alert(1)</script>',
      }),
    ).toEqual(rendered);
  });

  it.each([
    ['fa' as const, 'rtl', 'بازیابی رمز عبور Arena Core'],
    ['en' as const, 'ltr', 'Reset your Arena Core password'],
  ])('renders reset %s safely', (locale, direction, subject) => {
    const rendered = renderer.renderPasswordResetEmail({
      locale,
      resetUrl: 'https://app.example.com/reset-password?token=opaque-token',
      expiresAt,
    });
    expect(rendered.subject).toBe(subject);
    expect(rendered.html).toContain(`dir="${direction}"`);
    expect(rendered.text).toContain('/reset-password?token=');
    expect(rendered.html).not.toMatch(/javascript:|<script|<form|tracking/i);
  });
});

describe('email senders', () => {
  const message = createEmailMessage({
    to: { address: 'player@example.com' },
    from: { address: 'no-reply@arena-core.local' },
    subject: 'Test',
    text: 'Text',
    html: '<p>Text</p>',
  });

  it('captures messages in memory for tests', async () => {
    const sender = new InMemoryEmailSender();
    await expect(sender.send(message)).resolves.toMatchObject({
      accepted: ['player@example.com'],
      rejected: [],
    });
    expect(sender.messages).toEqual([message]);
  });

  it('creates one quiet SMTP transport, sends, verifies and closes', async () => {
    const transport: SmtpTransport = {
      sendMail: vi.fn(async () => ({
        messageId: 'message-1',
        accepted: ['player@example.com'],
        rejected: [],
      })),
      verify: vi.fn(async () => true),
      close: vi.fn(),
    };
    let transportOptions: Record<string, unknown> | undefined;
    const factory = vi.fn((options: Record<string, unknown>) => {
      transportOptions = options;
      return transport;
    });
    const sender = new SmtpEmailSender(
      {
        host: '127.0.0.1',
        port: 1025,
        secure: false,
        connectionTimeoutMs: 5000,
        greetingTimeoutMs: 5000,
        socketTimeoutMs: 10000,
      },
      factory,
    );
    expect(factory).toHaveBeenCalledWith(expect.objectContaining({ logger: false, debug: false }));
    expect(transportOptions).not.toHaveProperty('ignoreTLS');
    expect(transportOptions).not.toHaveProperty('requireTLS');
    expect(transport.verify).not.toHaveBeenCalled();
    await sender.verify();
    await expect(sender.send(message)).resolves.toMatchObject({ messageId: 'message-1' });
    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({ text: 'Text' }));
    sender.close();
    expect(transport.close).toHaveBeenCalledOnce();
  });

  it('sanitizes SMTP failures and rejects partial delivery', async () => {
    const failure = new SmtpEmailSender(
      {
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        username: 'account',
        password: 'smtp-secret-value',
        connectionTimeoutMs: 5000,
        greetingTimeoutMs: 5000,
        socketTimeoutMs: 10000,
      },
      () => ({
        sendMail: async () => {
          throw new Error('AUTH smtp-secret-value');
        },
        verify: async () => true,
        close: () => undefined,
      }),
    );
    try {
      await failure.send(message);
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(EmailError);
      expect(String(error)).not.toContain('smtp-secret-value');
      expect(JSON.stringify(error)).not.toContain('smtp-secret-value');
    }

    const rejected = new SmtpEmailSender(
      {
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        connectionTimeoutMs: 5000,
        greetingTimeoutMs: 5000,
        socketTimeoutMs: 10000,
      },
      () => ({
        sendMail: async () => ({ accepted: [], rejected: ['player@example.com'] }),
        verify: async () => true,
        close: () => undefined,
      }),
    );
    await expect(rejected.send(message)).rejects.toMatchObject({
      code: 'EMAIL_DELIVERY_REJECTED',
    });
  });
});
