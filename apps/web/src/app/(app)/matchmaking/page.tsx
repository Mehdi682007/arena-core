import Link from 'next/link';
import { Badge, Card, EmptyState } from '@/components/ui';
import { CompetitionAction } from '@/features/competition/actions';
import type { MatchmakingRequestView, ProposalView } from '@/features/competition/types';
import { serverApi } from '@/lib/api/server-api-client';
export default async function MatchmakingPage() {
  const [requests, proposal] = await Promise.all([
    serverApi<MatchmakingRequestView[]>('/matchmaking/requests?limit=20'),
    serverApi<ProposalView | null>('/matchmaking/proposals/current').catch(() => null),
  ]);
  const active = requests.find((item) =>
    ['PENDING', 'SEARCHING', 'PROPOSED'].includes(item.status),
  );
  return (
    <div className="stack">
      <h1>رقابت</h1>
      {proposal ? (
        <Card>
          <h2>پیشنهاد مسابقه</h2>
          <Badge>{proposal.status}</Badge>
          <p>
            مهلت:{' '}
            <time dateTime={proposal.expiresAt}>
              {new Intl.DateTimeFormat('fa', { dateStyle: 'short', timeStyle: 'medium' }).format(
                new Date(proposal.expiresAt),
              )}
            </time>
          </p>
          <Link className="button" href="/matchmaking/proposals">
            بررسی پیشنهاد
          </Link>
        </Card>
      ) : null}
      {active ? (
        <Card>
          <h2>جستجو در جریان است</h2>
          <Badge>{active.status}</Badge>
          <p>موقعیت صف و زمان تخمینی ساختگی نمایش داده نمی‌شود.</p>
          <div className="cluster">
            <CompetitionAction
              path={`/matchmaking/requests/${active.id}/cancel`}
              label="لغو جستجو"
              danger
            />
            <Link className="button secondary" href="/matchmaking">
              تازه‌سازی دستی
            </Link>
          </div>
        </Card>
      ) : (
        <EmptyState title="جستجوی فعالی ندارید">
          <Link className="button" href="/matchmaking/request">
            ساخت درخواست رقابت
          </Link>
        </EmptyState>
      )}
    </div>
  );
}
