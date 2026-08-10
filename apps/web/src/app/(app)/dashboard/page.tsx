import Link from 'next/link';
import { Alert, Card, EmptyState } from '@/components/ui';
import type { MatchView } from '@/features/competition/types';
import type { GameAccountView } from '@/features/settings/game-account-manager';
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

  const [ratings, notifications, matches, gameAccounts] = await Promise.all([
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

    serverApi<readonly MatchView[]>('/matches?limit=5').catch(() => []),

    serverApi<readonly GameAccountView[]>('/game-accounts').catch(() => []),
  ]);

  const wins = matches.filter((match) => match.status === 'COMPLETED').length;

  const losses = matches.filter((match) => match.status === 'CANCELLED').length;

  const highestRating = ratings.reduce((max, item) => Math.max(max, item.rating), 0);

  return (
    <div>
      <h1>{messages.hello(session.user.displayName)}</h1>

      {!session.user.emailVerified ? (
        <Alert error>
          {messages.emailNotVerified} <Link href="/verify-email">{messages.verifyEmail}</Link>
        </Alert>
      ) : null}

      {!session.user.onboardingCompleted ? <Alert>{messages.onboardingIncomplete}</Alert> : null}

      <div className="profile-stat-grid">
        <Card>
          <strong>{matches.length}</strong>
          <span>Matches</span>
        </Card>

        <Card>
          <strong>{wins}</strong>
          <span>Wins</span>
        </Card>

        <Card>
          <strong>{losses}</strong>
          <span>Losses</span>
        </Card>

        <Card>
          <strong>{highestRating}</strong>
          <span>Rating</span>
        </Card>
      </div>

      <div className="profile-content-grid">
        <Card>
          <h2>Recent Matches</h2>

          {matches.length ? (
            <ul>
              {matches.map((match) => (
                <li key={match.id}>
                  {match.game.name} - {match.status}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No matches yet</p>
          )}
        </Card>

        <Card>
          <h2>Game Accounts</h2>

          <p>{gameAccounts.length} connected accounts</p>

          <Link className="button secondary" href="/settings/game-accounts">
            Manage
          </Link>
        </Card>

        <Card>
          <h2>{messages.notificationsTitle}</h2>

          {notifications.items.length ? (
            notifications.items.map((item) => <p key={item.id}>{item.subject}</p>)
          ) : (
            <p className="muted">No notifications</p>
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
