import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import Link from 'next/link';
import { Badge, Card, EmptyState } from '@/components/ui';
import { CompetitionAction } from '@/features/competition/actions';
import type { MatchmakingRequestView, ProposalView } from '@/features/competition/types';
import { serverApi } from '@/lib/api/server-api-client';
import { presentStatus } from '@/i18n/presentation';
export default async function MatchmakingPage() {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  const [requests, proposal] = await Promise.all([
    serverApi<MatchmakingRequestView[]>('/matchmaking/requests?limit=20'),
    serverApi<ProposalView | null>('/matchmaking/proposals/current').catch(() => null),
  ]);
  const active = requests.find((item) =>
    ['PENDING', 'SEARCHING', 'PROPOSED'].includes(item.status),
  );
  return (
    <div className="stack">
      <h1>{ui.matchmaking}</h1>
      {proposal ? (
        <Card>
          <h2>{ui.competitionOffer}</h2>
          <Badge>{presentStatus(proposal.status, locale)}</Badge>
          <p>
            {ui.deadline}{' '}
            <time dateTime={proposal.expiresAt}>
              {new Intl.DateTimeFormat('fa', { dateStyle: 'short', timeStyle: 'medium' }).format(
                new Date(proposal.expiresAt),
              )}
            </time>
          </p>
          <Link className="button" href="/matchmaking/proposals">
            {ui.reviewTheOffer}
          </Link>
        </Card>
      ) : null}
      {active ? (
        <Card>
          <h2>{ui.theSearchIsInProgress}</h2>
          <Badge>{presentStatus(active.status, locale)}</Badge>
          <p>{ui.dummyQueuePositionAndEstimatedTimeAre}</p>
          <div className="cluster">
            <CompetitionAction
              path={`/matchmaking/requests/${active.id}/cancel`}
              label={ui.cancelSearch}
              danger
            />
            <Link className="button secondary" href="/matchmaking">
              {ui.manualRefresh}
            </Link>
          </div>
        </Card>
      ) : (
        <EmptyState title={ui.youHaveNoActiveSearch}>
          <Link className="button" href="/matchmaking/request">
            {ui.makingACompetitionApplication}
          </Link>
        </EmptyState>
      )}
    </div>
  );
}
