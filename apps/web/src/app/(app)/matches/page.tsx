import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import Link from 'next/link';
import { Badge, Card, EmptyState } from '@/components/ui';
import { statusLabel } from '@/features/competition/presentation';
import type { MatchView } from '@/features/competition/types';
import { serverApi } from '@/lib/api/server-api-client';
export default async function MatchesPage() {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  const matches = await serverApi<MatchView[]>('/matches?limit=50');
  if (!matches.length)
    return (
      <EmptyState title={ui.youHaveNoCompetition}>
        <Link className="button" href="/matchmaking">
          {ui.theStartOfTheCompetition}
        </Link>
      </EmptyState>
    );
  return (
    <div className="stack">
      <h1>{ui.competitions}</h1>
      <div className="grid">
        {matches.map((match) => (
          <Card key={match.id}>
            <h2>{match.game.name}</h2>
            <Badge>{statusLabel(match.status, locale)}</Badge>
            <p>
              {match.mode.name} {ui.opponent}{' '}
              {match.participants.find((item) => !item.isCurrentUser)?.displayHandle ??
                ui.uncertain}
            </p>
            <Link className="button secondary" href={`/matches/${match.id}`}>
              {ui.raceRoom}
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
