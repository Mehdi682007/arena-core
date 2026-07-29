import { MatchmakingForm } from '@/features/competition/matchmaking-form';
import type { CatalogGame, GameAccount } from '@/features/competition/types';
import { serverApi } from '@/lib/api/server-api-client';
export default async function RequestPage() {
  const [catalog, accounts] = await Promise.all([
    serverApi<{ games: CatalogGame[] }>('/catalog/games'),
    serverApi<GameAccount[]>('/game-accounts'),
  ]);
  const games = await Promise.all(
    catalog.games.map((game) => serverApi<CatalogGame>(`/catalog/games/${game.slug}`)),
  );
  return (
    <div className="stack">
      <h1>درخواست رقابت</h1>
      <p className="muted">حریف، امتیاز و ورودی توسط سرور تعیین می‌شود.</p>
      <MatchmakingForm games={games} accounts={accounts} />
    </div>
  );
}
