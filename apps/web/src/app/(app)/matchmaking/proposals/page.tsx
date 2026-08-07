import { Badge, Card, EmptyState } from '@/components/ui';
import { CompetitionAction } from '@/features/competition/actions';
import { Countdown } from '@/features/competition/countdown';
import type { ProposalView } from '@/features/competition/types';
import { getSession } from '@/features/session/session';
import { productMessagesFor } from '@/i18n/product-messages';
import { serverApi } from '@/lib/api/server-api-client';

export default async function ProposalPage() {
  const session = await getSession();
  if (session.status !== 'authenticated') return null;
  const locale = session.user.locale;
  const messages = productMessagesFor(locale).matchmaking;
  const proposal = await serverApi<ProposalView | null>('/matchmaking/proposals/current').catch(
    () => null,
  );
  if (!proposal) return <EmptyState title={messages.noActiveProposal} />;
  return (
    <Card>
      <h1>{messages.proposalTitle}</h1>
      <Badge>{proposal.status}</Badge>
      <p>
        {messages.yourAcceptance}: {proposal.myAcceptance ? messages.accepted : messages.waiting}
      </p>
      <p>
        {messages.opponentAcceptance}:{' '}
        {proposal.opponentAcceptance ? messages.accepted : messages.waiting}
      </p>
      <p>
        {messages.deadline}:{' '}
        <time dateTime={proposal.expiresAt}>
          {new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
            dateStyle: 'medium',
            timeStyle: 'medium',
          }).format(new Date(proposal.expiresAt))}
        </time>
      </p>
      <Countdown expiresAt={proposal.expiresAt} locale={locale} label={messages.timeRemaining} />
      <div className="cluster">
        <CompetitionAction
          path={`/matchmaking/proposals/${proposal.id}/accept`}
          label={messages.accept}
          redirectTo="/matches"
        />
        <CompetitionAction
          path={`/matchmaking/proposals/${proposal.id}/reject`}
          label={messages.reject}
          redirectTo="/matchmaking"
          danger
        />
      </div>
    </Card>
  );
}
