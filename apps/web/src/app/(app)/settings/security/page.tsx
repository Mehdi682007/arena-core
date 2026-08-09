import { uiMessagesFor } from '@/i18n/ui-messages';
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
  const ui = uiMessagesFor(locale);

  return (
    <div className="stack">
      <div>
        <h1>{ui.accountSecurity}</h1>

        <p className="muted">{ui.managePasswordsSessionsAndTwoStepAuthentication}</p>
      </div>

      <Card>
        <h2>{ui.twoStepAuthentication}</h2>

        <p className="muted">{ui.useTheAuthenticatorAppToFurtherProtect}</p>

        <Link className="button secondary" href="/settings/security/mfa">
          {ui.mfaManagement}
        </Link>
      </Card>

      <Card>
        <h2>{ui.changePassword}</h2>

        <PasswordChangeForm locale={locale} />
      </Card>

      <Card>
        <h2>{ui.activeMeetings}</h2>

        <Link className="button secondary" href="/settings/sessions">
          {ui.managementOfMeetings}
        </Link>
      </Card>
    </div>
  );
}
