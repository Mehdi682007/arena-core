import Link from 'next/link';
import { Alert, Card, EmptyState } from '@/components/ui';
import { getSession } from '@/features/session/session';
import { messagesFor } from '@/i18n/messages';
import { serverApi } from '@/lib/api/server-api-client';

export default async function DashboardPage() {
  const session = await getSession();

  if (session.status !== 'authenticated') {
    return null;
  }

  const locale = session.user.locale;
  const messages = messagesFor(locale).dashboard;

  const [ratings, notifications] = await Promise.all([
    serverApi<
      readonly {
        game: { name: string };
        mode: { name: string };
        rating: number;
        rank: number | null;
      }[]
    >('/ratings').catch(() => []),

    serverApi<{
      items: readonly {
        id: string;
        subject: string;
      }[];
    }>('/notifications?limit=3&unread=true').catch(() => ({
      items: [],
    })),
  ]);

  return (
    <div className="stack">
      <h1>{messages.hello(session.user.displayName)}</h1>

      {!session.user.emailVerified ? (
        <Alert error>
          {messages.emailNotVerified} <Link href="/verify-email">{messages.verifyEmail}</Link>
        </Alert>
      ) : null}

      {!session.user.onboardingCompleted ? <Alert>{messages.onboardingIncomplete}</Alert> : null}

      <div className="grid">
        <Card>
          <h2>{messages.ratingTitle}</h2>

          {ratings[0] ? (
            <p>
              {ratings[0].game.name} — {ratings[0].mode.name}:{' '}
              {new Intl.NumberFormat(locale === 'fa' ? 'fa' : 'en-US').format(ratings[0].rating)}
            </p>
          ) : (
            <p className="muted">{messages.noRating}</p>
          )}
        </Card>

        <Card>
          <h2>{messages.notificationsTitle}</h2>

          {notifications.items.length ? (
            <ul>
              {notifications.items.map((item) => (
                <li key={item.id}>{item.subject}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">{messages.noNotifications}</p>
          )}
        </Card>
      </div>

      <EmptyState title={messages.quickActions}>
        <Link className="button secondary" href="/profile">
          {messages.completeProfile}
        </Link>
      </EmptyState>
    </div>
  );
}
