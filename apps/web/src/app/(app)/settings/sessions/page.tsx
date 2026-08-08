import { getSession } from '@/features/session/session';
import { SessionManager, type UserSessionView } from '@/features/settings/session-manager';
import { serverApi } from '@/lib/api/server-api-client';
import { rc4MessagesFor } from '@/i18n/rc4-messages';

export default async function SessionsPage() {
  const session = await getSession();

  if (session.status !== 'authenticated') {
    return null;
  }

  const result = await serverApi<{
    items: readonly UserSessionView[];
  }>('/auth/sessions');

  const locale = session.user.locale;
  const messages = rc4MessagesFor(locale).sessionsPage;

  return (
    <div className="stack">
      <div>
        <h1>{messages.title}</h1>

        <p className="muted">{messages.description}</p>
      </div>

      <SessionManager initial={result.items} locale={locale} />
    </div>
  );
}
