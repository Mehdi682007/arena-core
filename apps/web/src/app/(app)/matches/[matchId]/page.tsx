import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import Link from 'next/link';
import { Badge, Card } from '@/components/ui';
import { CompetitionAction } from '@/features/competition/actions';
import { statusDescription, statusLabel } from '@/features/competition/presentation';
import { presentStatus } from '@/i18n/presentation';
import type {
  EntryView,
  MatchView,
  RatingHistoryView,
  ResultView,
  SettlementView,
} from '@/features/competition/types';
import { serverApi } from '@/lib/api/server-api-client';
export default async function MatchRoom({ params }: { params: Promise<{ matchId: string }> }) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
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
      <p>{statusDescription(match.status, locale)}</p>
      <Card>
        <h2>{ui.participants}</h2>
        {match.participants.map((item) => (
          <p key={item.side}>
            {item.isCurrentUser ? ui.you : item.displayHandle} — {item.platform.name} —{' '}
            {item.ready ? ui.ready : ui.waiting}
          </p>
        ))}
      </Card>
      <Card>
        <h2>{ui.rules}</h2>
        <p>
          {match.ruleset.name}
          {ui.edition}
          {new Intl.NumberFormat('fa').format(match.ruleset.version)}
        </p>
        <p>
          {match.mode.name} — {match.crossplay.name}
        </p>
      </Card>
      {entry ? (
        <Card>
          <h2>{ui.nonMonetaryEntry}</h2>
          <p>
            {entry.amount} ARENA_POINT — {presentStatus(entry.status, locale)}
          </p>
          <small>{ui.nonRedeemableAndOfNoMonetaryValue}</small>
        </Card>
      ) : null}
      {match.status === 'AWAITING_READY' && !mine?.ready ? (
        <CompetitionAction path={`/matches/${matchId}/ready`} label={ui.iAmReady} />
      ) : null}
      {match.status === 'READY' ? (
        <CompetitionAction path={`/matches/${matchId}/start`} label={ui.theStartOfTheRace} />
      ) : null}
      {['IN_PROGRESS', 'AWAITING_RESULT', 'RESULT_CONFLICT'].includes(match.status) ? (
        <Link className="button" href={`/matches/${matchId}/result`}>
          {ui.resultsAndDocuments}
        </Link>
      ) : null}
      <Link className="button secondary" href={`/matches/${matchId}/dispute`}>
        {ui.protest}
      </Link>
      {result ? (
        <Card>
          <h2>{ui.theResult}</h2>
          <p>{presentStatus(result.status, locale)}</p>
        </Card>
      ) : null}
      {settlement ? (
        <Card>
          <h2>{ui.nonMonetarySettlement}</h2>
          <p>
            {presentStatus(settlement.status, locale)} {ui.yourReceipt}
            {settlement.receivedAmount} ARENA_POINT
          </p>
        </Card>
      ) : null}
      {currentRating ? (
        <Card>
          <h2>{ui.currentRank}</h2>
          <p>{new Intl.NumberFormat('fa').format(currentRating.rating)}</p>
          {matchRating ? (
            <p>
              {ui.changesToThisMatch}{' '}
              {new Intl.NumberFormat('fa', { signDisplay: 'always' }).format(
                matchRating.ratingDelta,
              )}{' '}
              ({new Intl.NumberFormat('fa').format(matchRating.ratingBefore)} ←{' '}
              {new Intl.NumberFormat('fa').format(matchRating.ratingAfter)})
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
