import { Badge, Card, EmptyState } from '@/components/ui';
import { CompetitionAction } from '@/features/competition/actions';
import { Countdown } from '@/features/competition/countdown';
import type { ProposalView } from '@/features/competition/types';
import { serverApi } from '@/lib/api/server-api-client';
export default async function ProposalPage() {
  const proposal = await serverApi<ProposalView | null>('/matchmaking/proposals/current').catch(
    () => null,
  );
  if (!proposal) return <EmptyState title="پیشنهاد فعالی وجود ندارد" />;
  return (
    <Card>
      <h1>پیشنهاد مسابقه</h1>
      <Badge>{proposal.status}</Badge>
      <p>پذیرش شما: {proposal.myAcceptance ? 'انجام شده' : 'منتظر'}</p>
      <p>پذیرش طرف مقابل: {proposal.opponentAcceptance ? 'انجام شده' : 'منتظر'}</p>
      <time dateTime={proposal.expiresAt}>
        {new Intl.DateTimeFormat('fa', { dateStyle: 'medium', timeStyle: 'medium' }).format(
          new Date(proposal.expiresAt),
        )}
      </time>
      <Countdown expiresAt={proposal.expiresAt} />
      <div className="cluster">
        <CompetitionAction
          path={`/matchmaking/proposals/${proposal.id}/accept`}
          label="پذیرش"
          redirectTo="/matches"
        />
        <CompetitionAction
          path={`/matchmaking/proposals/${proposal.id}/reject`}
          label="رد"
          redirectTo="/matchmaking"
          danger
        />
      </div>
    </Card>
  );
}
