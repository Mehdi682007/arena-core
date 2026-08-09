import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import { MatchmakingForm } from '@/features/competition/matchmaking-form';
import type { CatalogGame, GameAccount } from '@/features/competition/types';
import { serverApi } from '@/lib/api/server-api-client';
export default async function RequestPage() {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  const [catalog, accounts] = await Promise.all([
    serverApi<{ games: CatalogGame[] }>('/catalog/games'),
    serverApi<GameAccount[]>('/game-accounts'),
  ]);
  const games = await Promise.all(
    catalog.games.map((game) => serverApi<CatalogGame>(`/catalog/games/${game.slug}`)),
  );
  return (
    <div className="stack">
      <h1>{ui.competitionRequest}</h1>
      <p className="muted">{ui.theOpponentScoreAndEntryAreDetermined}</p>
      <MatchmakingForm games={games} accounts={accounts} />
    </div>
  );
}
