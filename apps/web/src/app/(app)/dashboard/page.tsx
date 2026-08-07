import Link from 'next/link';
import { Alert, Card, EmptyState } from '@/components/ui';
import { getSession } from '@/features/session/session';
import { productMessagesFor } from '@/i18n/product-messages';
import { serverApi } from '@/lib/api/server-api-client';

export default async function DashboardPage() {
  const session = await getSession();
  if (session.status !== 'authenticated') return null;
  const locale = session.user.locale;
  const messages = productMessagesFor(locale).dashboard;
  const numberLocale = locale === 'fa' ? 'fa-IR' : 'en-US';
  const [ratings, notifications] = await Promise.all([
    serverApi<
      readonly {
        game: { name: string };
        mode: { name: string };
        rating: number;
        rank: number | null;
      }[]
    >('/ratings').catch(() => []),
    serverApi<{ items: readonly { id: string; subject: string }[] }>(
      '/notifications?limit=3&unread=true',
    ).catch(() => ({ items: [] })),
  ]);
  return (
    <div className="stack">
      <h1>{messages.greeting(session.user.displayName)}</h1>
      {!session.user.emailVerified ? (
        <Alert error>
          {messages.verifyEmail} <Link href="/verify-email">{messages.verifyEmailAction}</Link>
        </Alert>
      ) : null}
      {!session.user.onboardingCompleted ? <Alert>{messages.completeOnboarding}</Alert> : null}
      <div className="grid">
        <Card>
          <h2>{messages.ratingTitle}</h2>
          {ratings[0] ? (
            <p>
              {ratings[0].game.name} — {ratings[0].mode.name}:{' '}
              {new Intl.NumberFormat(numberLocale).format(ratings[0].rating)}
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
        <Link className="button secondary" href="/settings/profile">
          {messages.completeProfile}
        </Link>
      </EmptyState>
    </div>
  );
}
