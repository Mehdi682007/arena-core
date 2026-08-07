import Link from 'next/link';
import { Badge, Card, EmptyState } from '@/components/ui';
import { statusLabel } from '@/features/competition/presentation';
import type { MatchView } from '@/features/competition/types';
import { getSession } from '@/features/session/session';
import { productMessagesFor } from '@/i18n/product-messages';
import { serverApi } from '@/lib/api/server-api-client';

export default async function MatchesPage() {
  const session = await getSession();
  if (session.status !== 'authenticated') return null;
  const locale = session.user.locale;
  const messages = productMessagesFor(locale).matches;
  const matches = await serverApi<MatchView[]>('/matches?limit=50');
  if (!matches.length)
    return (
      <EmptyState title={messages.empty}>
        <Link className="button" href="/matchmaking">
          {messages.start}
        </Link>
      </EmptyState>
    );
  return (
    <div className="stack">
      <h1>{messages.title}</h1>
      <div className="grid">
        {matches.map((match) => (
          <Card key={match.id}>
            <h2>{match.game.name}</h2>
            <Badge>{statusLabel(match.status, locale)}</Badge>
            <p>
              {match.mode.name} — {messages.opponent}:{' '}
              {match.participants.find((item) => !item.isCurrentUser)?.displayHandle ??
                messages.unknownOpponent}
            </p>
            <Link className="button secondary" href={`/matches/${match.id}`}>
              {messages.room}
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
