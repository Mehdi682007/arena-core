import { getSession } from '@/features/session/session';
import { PhoneManager, type UserPhoneView } from '@/features/settings/phone-manager';
import { serverApi } from '@/lib/api/server-api-client';
import { rc4MessagesFor } from '@/i18n/rc4-messages';

export default async function PhoneSettingsPage() {
  const session = await getSession();

  if (session.status !== 'authenticated') {
    return null;
  }

  const result = await serverApi<{
    items: readonly UserPhoneView[];
  }>('/auth/phone');

  const locale = session.user.locale;
  const messages = rc4MessagesFor(locale).phonePage;

  return (
    <div className="stack">
      <div>
        <h1>{messages.title}</h1>

        <p className="muted">{messages.description}</p>
      </div>

      <PhoneManager initialPhones={result.items} locale={locale} />
    </div>
  );
}
