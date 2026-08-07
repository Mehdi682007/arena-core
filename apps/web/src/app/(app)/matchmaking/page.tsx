import Link from 'next/link';
import { Badge, Card, EmptyState } from '@/components/ui';
import { CompetitionAction } from '@/features/competition/actions';
import type { MatchmakingRequestView, ProposalView } from '@/features/competition/types';
import { getSession } from '@/features/session/session';
import { productMessagesFor } from '@/i18n/product-messages';
import { serverApi } from '@/lib/api/server-api-client';

export default async function MatchmakingPage() {
  const session = await getSession();
  if (session.status !== 'authenticated') return null;
  const locale = session.user.locale;
  const messages = productMessagesFor(locale).matchmaking;
  const [requests, proposal] = await Promise.all([
    serverApi<MatchmakingRequestView[]>('/matchmaking/requests?limit=20'),
    serverApi<ProposalView | null>('/matchmaking/proposals/current').catch(() => null),
  ]);
  const active = requests.find((item) =>
    ['PENDING', 'SEARCHING', 'PROPOSED'].includes(item.status),
  );
  return (
    <div className="stack">
      <h1>{messages.title}</h1>
      {proposal ? (
        <Card>
          <h2>{messages.proposalTitle}</h2>
          <Badge>{proposal.status}</Badge>
          <p>
            {messages.deadline}:{' '}
            <time dateTime={proposal.expiresAt}>
              {new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
                dateStyle: 'short',
                timeStyle: 'medium',
              }).format(new Date(proposal.expiresAt))}
            </time>
          </p>
          <Link className="button" href="/matchmaking/proposals">
            {messages.reviewProposal}
          </Link>
        </Card>
      ) : null}
      {active ? (
        <Card>
          <h2>{messages.searchingTitle}</h2>
          <Badge>{active.status}</Badge>
          <p>{messages.noFakeQueueEstimate}</p>
          <div className="cluster">
            <CompetitionAction
              path={`/matchmaking/requests/${active.id}/cancel`}
              label={messages.cancelSearch}
              danger
            />
            <Link className="button secondary" href="/matchmaking">
              {messages.refresh}
            </Link>
          </div>
        </Card>
      ) : (
        <EmptyState title={messages.noActiveSearch}>
          <Link className="button" href="/matchmaking/request">
            {messages.createRequest}
          </Link>
        </EmptyState>
      )}
    </div>
  );
}
