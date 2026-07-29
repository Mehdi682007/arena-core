import Link from 'next/link';
import { Badge, Card } from '@/components/ui';
import { CompetitionAction } from '@/features/competition/actions';
import { matchStatus, statusLabel } from '@/features/competition/presentation';
import type {
  EntryView,
  MatchView,
  RatingHistoryView,
  ResultView,
  SettlementView,
} from '@/features/competition/types';
import { serverApi } from '@/lib/api/server-api-client';
export default async function MatchRoom({ params }: { params: Promise<{ matchId: string }> }) {
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
        <Badge>{statusLabel(match.status)}</Badge>
      </div>
      <p>{matchStatus[match.status]?.description}</p>
      <Card>
        <h2>شرکت‌کنندگان</h2>
        {match.participants.map((item) => (
          <p key={item.side}>
            {item.isCurrentUser ? 'شما' : item.displayHandle} — {item.platform.name} —{' '}
            {item.ready ? 'آماده' : 'منتظر'}
          </p>
        ))}
      </Card>
      <Card>
        <h2>قوانین</h2>
        <p>
          {match.ruleset.name}، نسخه {new Intl.NumberFormat('fa').format(match.ruleset.version)}
        </p>
        <p>
          {match.mode.name} — {match.crossplay.name}
        </p>
      </Card>
      {entry ? (
        <Card>
          <h2>ورودی غیرپولی</h2>
          <p>
            {entry.amount} ARENA_POINT — {entry.status}
          </p>
          <small>غیرقابل برداشت و بدون ارزش پولی</small>
        </Card>
      ) : null}
      {match.status === 'AWAITING_READY' && !mine?.ready ? (
        <CompetitionAction path={`/matches/${matchId}/ready`} label="آماده‌ام" />
      ) : null}
      {match.status === 'READY' ? (
        <CompetitionAction path={`/matches/${matchId}/start`} label="شروع مسابقه" />
      ) : null}
      {['IN_PROGRESS', 'AWAITING_RESULT', 'RESULT_CONFLICT'].includes(match.status) ? (
        <Link className="button" href={`/matches/${matchId}/result`}>
          نتیجه و مدارک
        </Link>
      ) : null}
      <Link className="button secondary" href={`/matches/${matchId}/dispute`}>
        اعتراض
      </Link>
      {result ? (
        <Card>
          <h2>نتیجه</h2>
          <p>{result.status}</p>
        </Card>
      ) : null}
      {settlement ? (
        <Card>
          <h2>تسویه غیرپولی</h2>
          <p>
            {settlement.status} — دریافتی شما: {settlement.receivedAmount} ARENA_POINT
          </p>
        </Card>
      ) : null}
      {currentRating ? (
        <Card>
          <h2>رتبه فعلی</h2>
          <p>{new Intl.NumberFormat('fa').format(currentRating.rating)}</p>
          {matchRating ? (
            <p>
              تغییر این مسابقه:{' '}
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
