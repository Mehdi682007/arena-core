import { notFound } from 'next/navigation';
import { adminApi } from '@/features/admin/api';
import { GameAccountReviewPanel } from '@/features/admin/game-account-operations';
import type { GameAccountView } from '@/features/settings/game-account-manager';
type Account = GameAccountView & {
  userId: string;
  normalizedHandle: string;
  reviewedByUserId: string | null;
  ownerDisplayName: string | null;
};
type Review = {
  id: string;
  action: string;
  reasonCode: string | null;
  note: string | null;
  actorUserId: string | null;
  createdAt: string;
};
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const capabilities = await adminApi.capabilities();
  const [account, reviews] = await Promise.all([
    adminApi.resource<Account>(`/admin/game-accounts/${encodeURIComponent(id)}`).catch(() => null),
    capabilities.permissions.includes('game_accounts.audit.read')
      ? adminApi.resource<readonly Review[]>(
          `/admin/game-accounts/${encodeURIComponent(id)}/reviews`,
        )
      : Promise.resolve([]),
  ]);
  if (!account) notFound();
  return (
    <GameAccountReviewPanel
      account={account}
      reviews={reviews}
      permissions={capabilities.permissions}
    />
  );
}
