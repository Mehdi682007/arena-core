import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import Link from 'next/link';
import { EmptyState, ErrorState, Select } from '@/components/ui';
import { getWebConfig } from '@/config';
import { apiRequest } from '@/lib/api/api-client';
import { ApiError } from '@/lib/api/api-error';
interface Entry {
  rank: number;
  player: { displayName: string; gameHandle: string };
  rating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}
export const revalidate = 30;
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; cursor?: string }>;
}) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  const query = await searchParams;
  const mode = query.mode === 'two-v-two' ? 'two-v-two' : 'one-v-one';
  let page: { items: Entry[]; nextCursor: string | null };
  try {
    page = await apiRequest(
      getWebConfig().server.apiBaseUrl,
      `/leaderboards/fc-26/${mode}?limit=25${query.cursor ? `&cursor=${encodeURIComponent(query.cursor)}` : ''}`,
      { cache: 'force-cache' },
    );
  } catch (error) {
    return (
      <div className="stack">
        <h1>{ui.fcRatingN26}</h1>
        <ErrorState requestId={error instanceof ApiError ? error.requestId : undefined} />
      </div>
    );
  }
  return (
    <div className="stack">
      <h1>{ui.fcRatingN26}</h1>
      <form method="get" className="cluster">
        <label htmlFor="mode">{ui.gameMode}</label>
        <Select id="mode" name="mode" defaultValue={mode}>
          <option value="one-v-one">{ui.n1AgainstN1}</option>
          <option value="two-v-two">{ui.n2AgainstN2}</option>
        </Select>
        <button className="button secondary">{ui.apply}</button>
      </form>
      {page.items.length === 0 ? (
        <EmptyState title={ui.noRatingHasBeenPublishedYet} />
      ) : (
        <div className="card table-wrap">
          <table>
            <caption>{ui.generalRankingOfPlayers}</caption>
            <thead>
              <tr>
                <th>{ui.rank}</th>
                <th>{ui.thePlayer}</th>
                <th>{ui.gameId}</th>
                <th>{ui.score}</th>
                <th>{ui.game}</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((entry) => (
                <tr key={`${String(entry.rank)}-${entry.player.gameHandle}`}>
                  <td>{new Intl.NumberFormat('fa').format(entry.rank)}</td>
                  <td>{entry.player.displayName}</td>
                  <td className="ltr">{entry.player.gameHandle}</td>
                  <td>{new Intl.NumberFormat('fa').format(entry.rating)}</td>
                  <td>{new Intl.NumberFormat('fa').format(entry.matchesPlayed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page.nextCursor ? (
        <Link href={`/leaderboards?mode=${mode}&cursor=${encodeURIComponent(page.nextCursor)}`}>
          {ui.nextPage}
        </Link>
      ) : null}
    </div>
  );
}
