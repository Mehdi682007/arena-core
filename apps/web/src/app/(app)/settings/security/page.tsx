import Link from 'next/link';
import { Card } from '@/components/ui';
import { PasswordChangeForm } from '@/features/settings/password-change-form';
import type { AppLocale } from '@/i18n/config';
import { messagesFor } from '@/i18n/messages';
import { serverApi } from '@/lib/api/server-api-client';

interface ProfileResponse {
  readonly profile: { readonly locale: AppLocale };
}

export default async function SecuritySettingsPage() {
  const response = await serverApi<ProfileResponse>('/profile');
  const locale = response.profile.locale;
  const messages = messagesFor(locale).settings;
  return (
    <div className="stack">
      <div>
        <h1>{messages.securityTitle}</h1>
        <p className="muted">{messages.securityDescription}</p>
      </div>

      <Card>
        <h2>{messages.password.title}</h2>
        <PasswordChangeForm locale={locale} />
      </Card>

      <Card>
        <h2>{messages.sessionsTitle}</h2>
        <p>{messages.sessionsDescription}</p>
        <Link className="button secondary" href="/settings/sessions">
          {messages.sessionsTitle}
        </Link>
      </Card>
    </div>
  );
}
