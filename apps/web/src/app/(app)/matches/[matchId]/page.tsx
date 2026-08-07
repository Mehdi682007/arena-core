import Link from 'next/link';
import { Badge, Card } from '@/components/ui';
import { CompetitionAction } from '@/features/competition/actions';
import { competitionMessagesFor } from '@/features/competition/messages';
import { matchStatusFor, statusLabel } from '@/features/competition/presentation';
import type {
  EntryView,
  MatchView,
  RatingHistoryView,
  ResultView,
  SettlementView,
} from '@/features/competition/types';
import { getSession } from '@/features/session/session';
import { serverApi } from '@/lib/api/server-api-client';

export default async function MatchRoom({ params }: { params: Promise<{ matchId: string }> }) {
  const session = await getSession();
  if (session.status !== 'authenticated') return null;
  const locale = session.user.locale;
  const messages = competitionMessagesFor(locale).room;
  const numberLocale = locale === 'fa' ? 'fa-IR' : 'en-US';
  const { matchId } = await params;
  const [match, result, entry, settlement, ratings] = await Promise.all([
    serverApi<MatchView>(`/matches/${matchId}`),
    serverApi<ResultView>(`/matches/${matchId}/result`).catch(() => null),
    serverApi<EntryView>(`/matches/${matchId}/entry-reservation`).catch(() => null),
    serverApi<SettlementView>(`/matches/${matchId}/settlement`).catch(() => null),
    serverApi<
      readonly {
        game: { key: string };
        mode: { key: string };
        rating: number;
        rank: number | null;
      }[]
    >('/ratings').catch(() => []),
  ]);
  const mine = match.participants.find((item) => item.isCurrentUser);
  const currentRating = ratings.find(
    (item) => item.game.key === match.game.key && item.mode.key === match.mode.key,
  );
  const ratingHistory = await serverApi<RatingHistoryView>(
    `/ratings/${encodeURIComponent(match.game.key)}/${encodeURIComponent(match.mode.key)}/history?limit=50`,
  ).catch(() => ({ items: [], nextCursor: null }));
  const matchRating = ratingHistory.items.find((item) => item.matchId === matchId);
  return (
    <div className="stack">
      <div className="cluster">
        <h1>{match.game.name}</h1>
        <Badge>{statusLabel(match.status, locale)}</Badge>
      </div>
      <p>{matchStatusFor(locale)[match.status]?.description}</p>
      <Card>
        <h2>{messages.participants}</h2>
        {match.participants.map((item) => (
          <p key={item.side}>
            {item.isCurrentUser ? messages.you : item.displayHandle} — {item.platform.name} —{' '}
            {item.ready ? messages.ready : messages.waiting}
          </p>
        ))}
      </Card>
      <Card>
        <h2>{messages.rules}</h2>
        <p>
          {match.ruleset.name}, {messages.version}{' '}
          {new Intl.NumberFormat(numberLocale).format(match.ruleset.version)}
        </p>
        <p>
          {match.mode.name} — {match.crossplay.name}
        </p>
      </Card>
      {entry ? (
        <Card>
          <h2>{messages.nonMonetaryEntry}</h2>
          <p>
            {entry.amount} ARENA_POINT — {entry.status}
          </p>
          <small>{messages.nonWithdrawable}</small>
        </Card>
      ) : null}
      {match.status === 'AWAITING_READY' && !mine?.ready ? (
        <CompetitionAction path={`/matches/${matchId}/ready`} label={messages.imReady} />
      ) : null}
      {match.status === 'READY' ? (
        <CompetitionAction path={`/matches/${matchId}/start`} label={messages.startMatch} />
      ) : null}
      {['IN_PROGRESS', 'AWAITING_RESULT', 'RESULT_CONFLICT'].includes(match.status) ? (
        <Link className="button" href={`/matches/${matchId}/result`}>
          {messages.resultAndEvidence}
        </Link>
      ) : null}
      <Link className="button secondary" href={`/matches/${matchId}/dispute`}>
        {messages.dispute}
      </Link>
      {result ? (
        <Card>
          <h2>{messages.result}</h2>
          <p>{result.status}</p>
        </Card>
      ) : null}
      {settlement ? (
        <Card>
          <h2>{messages.nonMonetarySettlement}</h2>
          <p>
            {settlement.status} — {messages.received}: {settlement.receivedAmount} ARENA_POINT
          </p>
        </Card>
      ) : null}
      {currentRating ? (
        <Card>
          <h2>{messages.currentRating}</h2>
          <p>{new Intl.NumberFormat(numberLocale).format(currentRating.rating)}</p>
          {matchRating ? (
            <p>
              {messages.matchRatingChange}:{' '}
              {new Intl.NumberFormat(numberLocale, { signDisplay: 'always' }).format(
                matchRating.ratingDelta,
              )}{' '}
              ({new Intl.NumberFormat(numberLocale).format(matchRating.ratingBefore)} ←{' '}
              {new Intl.NumberFormat(numberLocale).format(matchRating.ratingAfter)})
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
