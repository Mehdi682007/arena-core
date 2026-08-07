import Link from 'next/link';
import { EmptyState, ErrorState, Select } from '@/components/ui';
import { getWebConfig } from '@/config';
import type { CatalogGame, CatalogGameSummary } from '@/features/competition/types';
import { leaderboardMessagesFor } from '@/i18n/leaderboard-messages';
import { getServerLocale } from '@/i18n/server';
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
  searchParams: Promise<{ game?: string; mode?: string; cursor?: string }>;
}) {
  const locale = await getServerLocale();
  const messages = leaderboardMessagesFor(locale);
  const numberLocale = locale === 'fa' ? 'fa-IR' : 'en-US';
  const query = await searchParams;
  const apiBaseUrl = getWebConfig().server.apiBaseUrl;

  let summaries: CatalogGameSummary[];
  try {
    const catalog = await apiRequest<{ games: CatalogGameSummary[] }>(
      apiBaseUrl,
      '/catalog/games',
      { cache: 'force-cache' },
    );
    summaries = catalog.games;
  } catch (error) {
    return (
      <div className="stack">
        <h1>{messages.genericTitle}</h1>
        <ErrorState requestId={error instanceof ApiError ? error.requestId : undefined} />
      </div>
    );
  }

  if (!summaries.length) return <EmptyState title={messages.emptyGames} />;

  const selectedSummary = summaries.find((game) => game.slug === query.game) ?? summaries[0];
  if (!selectedSummary) return <EmptyState title={messages.emptyGames} />;

  let game: CatalogGame;
  try {
    game = await apiRequest<CatalogGame>(
      apiBaseUrl,
      `/catalog/games/${encodeURIComponent(selectedSummary.slug)}`,
      { cache: 'force-cache' },
    );
  } catch (error) {
    return (
      <div className="stack">
        <h1>{messages.title(selectedSummary.name)}</h1>
        <ErrorState requestId={error instanceof ApiError ? error.requestId : undefined} />
      </div>
    );
  }

  if (!game.modes.length) {
    return (
      <div className="stack">
        <h1>{messages.title(game.name)}</h1>
        <EmptyState title={messages.emptyModes} />
      </div>
    );
  }

  const mode = game.modes.find((item) => item.slug === query.mode) ?? game.modes[0];
  if (!mode) return <EmptyState title={messages.emptyModes} />;

  let page: { items: Entry[]; nextCursor: string | null };
  try {
    page = await apiRequest(
      apiBaseUrl,
      `/leaderboards/${encodeURIComponent(game.key)}/${encodeURIComponent(mode.key)}?limit=25${query.cursor ? `&cursor=${encodeURIComponent(query.cursor)}` : ''}`,
      { cache: 'force-cache' },
    );
  } catch (error) {
    return (
      <div className="stack">
        <h1>{messages.title(game.name)}</h1>
        <ErrorState requestId={error instanceof ApiError ? error.requestId : undefined} />
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>{messages.title(game.name)}</h1>
      <form method="get" className="cluster">
        <label htmlFor="game">{messages.game}</label>
        <Select id="game" name="game" defaultValue={game.slug}>
          {summaries.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </Select>
        <label htmlFor="mode">{messages.mode}</label>
        <Select id="mode" name="mode" defaultValue={mode.slug}>
          {game.modes.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </Select>
        <button className="button secondary">{messages.apply}</button>
      </form>
      {page.items.length === 0 ? (
        <EmptyState title={messages.emptyLeaderboard} />
      ) : (
        <div className="card table-wrap">
          <table>
            <caption>{messages.caption}</caption>
            <thead>
              <tr>
                <th>{messages.rank}</th>
                <th>{messages.player}</th>
                <th>{messages.gameHandle}</th>
                <th>{messages.rating}</th>
                <th>{messages.matches}</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((entry) => (
                <tr key={`${String(entry.rank)}-${entry.player.gameHandle}`}>
                  <td>{new Intl.NumberFormat(numberLocale).format(entry.rank)}</td>
                  <td>{entry.player.displayName}</td>
                  <td className="ltr">{entry.player.gameHandle}</td>
                  <td>{new Intl.NumberFormat(numberLocale).format(entry.rating)}</td>
                  <td>{new Intl.NumberFormat(numberLocale).format(entry.matchesPlayed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page.nextCursor ? (
        <Link
          href={`/leaderboards?game=${encodeURIComponent(game.slug)}&mode=${encodeURIComponent(mode.slug)}&cursor=${encodeURIComponent(page.nextCursor)}`}
        >
          {messages.nextPage}
        </Link>
      ) : null}
    </div>
  );
}
