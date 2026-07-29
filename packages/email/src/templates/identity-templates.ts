import { EmailError } from '../domain/email-errors';
import { assertSafeHttpUrl, escapeHtml } from './escaping';

export type EmailLocale = 'fa' | 'en';

export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface IdentityTemplateInput {
  readonly locale: EmailLocale;
  readonly recipientName?: string;
  readonly actionUrl: string;
  readonly expiresAt: Date;
}

function expiry(date: Date, locale: EmailLocale): string {
  if (Number.isNaN(date.getTime())) throw new EmailError('EMAIL_TEMPLATE_ERROR');
  return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
}

function render(
  appName: string,
  kind: 'verification' | 'reset',
  input: IdentityTemplateInput,
): RenderedEmail {
  const url = assertSafeHttpUrl(input.actionUrl);
  const isFa = input.locale === 'fa';
  const title = isFa
    ? kind === 'verification'
      ? `تأیید ایمیل حساب ${appName}`
      : `بازیابی رمز عبور ${appName}`
    : kind === 'verification'
      ? `Verify your ${appName} email`
      : `Reset your ${appName} password`;
  const action = isFa
    ? kind === 'verification'
      ? 'تأیید ایمیل'
      : 'تغییر رمز عبور'
    : kind === 'verification'
      ? 'Verify email'
      : 'Reset password';
  const intro = isFa
    ? kind === 'verification'
      ? 'برای تکمیل ساخت حساب، ایمیل خود را تأیید کنید.'
      : 'برای انتخاب رمز عبور جدید از پیوند زیر استفاده کنید.'
    : kind === 'verification'
      ? 'Verify your email to finish creating your account.'
      : 'Use the link below to choose a new password.';
  const warning = isFa
    ? 'اگر این درخواست را انجام نداده‌اید، این پیام را نادیده بگیرید. این پیوند را برای پشتیبانی ارسال نکنید.'
    : 'If you did not make this request, ignore this email. Do not send this link to support.';
  const expires = expiry(input.expiresAt, input.locale);
  const greeting =
    input.recipientName === undefined
      ? isFa
        ? 'سلام،'
        : 'Hello,'
      : isFa
        ? `سلام ${input.recipientName}،`
        : `Hello ${input.recipientName},`;
  const text = `${greeting}\n\n${intro}\n\n${action}: ${url}\n\n${isFa ? 'زمان انقضا (UTC)' : 'Expires (UTC)'}: ${expires}\n\n${warning}\n\n${appName}`;
  const html = `<!doctype html><html lang="${isFa ? 'fa' : 'en'}" dir="${isFa ? 'rtl' : 'ltr'}"><body style="font-family:Arial,sans-serif;line-height:1.6;color:#172033"><main style="max-width:600px;margin:0 auto;padding:24px"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(greeting)}</p><p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;background:#2457d6;color:#fff;text-decoration:none;border-radius:6px">${escapeHtml(action)}</a></p><p>${isFa ? 'اگر دکمه کار نکرد، این پیوند را باز کنید:' : 'If the button does not work, open this link:'}<br><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p><p><strong>${isFa ? 'زمان انقضا (UTC)' : 'Expires (UTC)'}:</strong> ${escapeHtml(expires)}</p><p>${escapeHtml(warning)}</p><footer style="margin-top:28px;color:#667085">${escapeHtml(appName)}</footer></main></body></html>`;
  return Object.freeze({ subject: title, text, html });
}

export class IdentityEmailTemplateRenderer {
  public constructor(private readonly appName: string) {
    if (appName.length === 0 || appName.length > 80 || /[\r\n]/.test(appName)) {
      throw new EmailError('EMAIL_CONFIGURATION_ERROR');
    }
  }

  public renderVerificationEmail(
    input: Omit<IdentityTemplateInput, 'actionUrl'> & { verificationUrl: string },
  ): RenderedEmail {
    return render(this.appName, 'verification', {
      ...input,
      actionUrl: input.verificationUrl,
    });
  }

  public renderPasswordResetEmail(
    input: Omit<IdentityTemplateInput, 'actionUrl'> & { resetUrl: string },
  ): RenderedEmail {
    return render(this.appName, 'reset', { ...input, actionUrl: input.resetUrl });
  }
}
