import Link from 'next/link';
import { Card } from '@/components/ui';
import { PasswordChangeForm } from '@/features/settings/password-change-form';
import { getSession } from '@/features/session/session';

export default async function SecuritySettingsPage() {
  const session = await getSession();

  if (session.status !== 'authenticated') {
    return null;
  }

  const locale = session.user.locale;

  return (
    <div className="stack">
      <div>
        <h1>{locale === 'fa' ? 'امنیت حساب' : 'Account security'}</h1>

        <p className="muted">
          {locale === 'fa'
            ? 'گذرواژه، نشست‌ها و احراز هویت دومرحله‌ای را مدیریت کنید.'
            : 'Manage your password, sessions, and two-factor authentication.'}
        </p>
      </div>

      <Card>
        <h2>{locale === 'fa' ? 'احراز هویت دومرحله‌ای' : 'Two-factor authentication'}</h2>

        <p className="muted">
          {locale === 'fa'
            ? 'برای محافظت بیشتر از حساب، از برنامه Authenticator استفاده کنید.'
            : 'Use an authenticator app for stronger account protection.'}
        </p>

        <Link className="button secondary" href="/settings/security/mfa">
          {locale === 'fa' ? 'مدیریت MFA' : 'Manage MFA'}
        </Link>
      </Card>

      <Card>
        <h2>{locale === 'fa' ? 'تغییر گذرواژه' : 'Change password'}</h2>

        <PasswordChangeForm locale={locale} />
      </Card>

      <Card>
        <h2>{locale === 'fa' ? 'نشست‌های فعال' : 'Active sessions'}</h2>

        <Link className="button secondary" href="/settings/sessions">
          {locale === 'fa' ? 'مدیریت نشست‌ها' : 'Manage sessions'}
        </Link>
      </Card>
    </div>
  );
}
