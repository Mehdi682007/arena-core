import { notFound } from 'next/navigation';
import { GameAccountDetail } from '@/features/settings/game-account-detail';
import type { GameAccountView } from '@/features/settings/game-account-manager';
import { getSession } from '@/features/session/session';
import { serverApi } from '@/lib/api/server-api-client';

export default async function GameAccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const session = await getSession();
  if (session.status !== 'authenticated') return null;
  const { accountId } = await params;
  const account = await serverApi<GameAccountView>(
    `/game-accounts/${encodeURIComponent(accountId)}`,
  ).catch(() => null);
  if (!account) notFound();
  return <GameAccountDetail account={account} locale={session.user.locale} />;
}
