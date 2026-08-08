import { getSession } from '@/features/session/session';
import {
  MfaEnrollmentManager,
  type MfaStatusView,
} from '@/features/settings/mfa-enrollment-manager';
import { serverApi } from '@/lib/api/server-api-client';
import { rc4MessagesFor } from '@/i18n/rc4-messages';

export default async function MfaSettingsPage() {
  const session = await getSession();

  if (session.status !== 'authenticated') {
    return null;
  }

  const status = await serverApi<MfaStatusView>('/auth/mfa');

  const locale = session.user.locale;

  return (
    <div className="stack">
      <div>
        <h1>{rc4MessagesFor(locale).mfa.settingsSecurityMfaPage01}</h1>

        <p className="muted">{rc4MessagesFor(locale).mfa.settingsSecurityMfaPage02}</p>
      </div>

      <MfaEnrollmentManager locale={locale} initialStatus={status} />
    </div>
  );
}
