import { adminApi } from '@/features/admin/api';
import { GameAccountQueue, type GameAccountPage } from '@/features/admin/game-account-operations';

type Search = Record<string, string | string[] | undefined>;
const value = (query: Search, key: string) => {
  const current = query[key];
  return typeof current === 'string' ? current : '';
};

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const input = await searchParams;
  const filters: Record<string, string> = {};
  for (const key of [
    'page',
    'pageSize',
    'status',
    'gameId',
    'platformId',
    'reviewerUserId',
    'submittedFrom',
    'submittedTo',
    'recentlyChanged',
    'userSearch',
    'externalId',
  ]) {
    const item = value(input, key);
    if (item) filters[key] = item;
  }
  const apiQuery = new URLSearchParams(filters);
  const submittedFrom = filters.submittedFrom;
  const submittedTo = filters.submittedTo;
  if (submittedFrom) apiQuery.set('submittedFrom', `${submittedFrom}T00:00:00.000Z`);
  if (submittedTo) {
    const exclusive = new Date(`${submittedTo}T00:00:00.000Z`);
    exclusive.setUTCDate(exclusive.getUTCDate() + 1);
    apiQuery.set('submittedTo', exclusive.toISOString());
  }
  if (!apiQuery.has('page')) apiQuery.set('page', '1');
  if (!apiQuery.has('pageSize')) apiQuery.set('pageSize', '25');
  const result = await adminApi.resource<GameAccountPage>(
    `/admin/game-accounts?${apiQuery.toString()}`,
  );
  return <GameAccountQueue result={result} filters={filters} />;
}
