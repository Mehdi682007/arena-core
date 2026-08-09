import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import { Badge, Card, EmptyState } from '@/components/ui';
import { CompetitionAction } from '@/features/competition/actions';
import { Countdown } from '@/features/competition/countdown';
import type { ProposalView } from '@/features/competition/types';
import { serverApi } from '@/lib/api/server-api-client';
import { presentStatus } from '@/i18n/presentation';
export default async function ProposalPage() {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  const proposal = await serverApi<ProposalView | null>('/matchmaking/proposals/current').catch(
    () => null,
  );
  if (!proposal) return <EmptyState title={ui.thereAreNoActiveOffers} />;
  return (
    <Card>
      <h1>{ui.competitionOffer}</h1>
      <Badge>{presentStatus(proposal.status, locale)}</Badge>
      <p>
        {ui.yourAcceptance}
        {proposal.myAcceptance ? ui.done : ui.waiting}
      </p>
      <p>
        {ui.acceptanceOfTheOtherParty}
        {proposal.opponentAcceptance ? ui.done : ui.waiting}
      </p>
      <time dateTime={proposal.expiresAt}>
        {new Intl.DateTimeFormat('fa', { dateStyle: 'medium', timeStyle: 'medium' }).format(
          new Date(proposal.expiresAt),
        )}
      </time>
      <Countdown expiresAt={proposal.expiresAt} />
      <div className="cluster">
        <CompetitionAction
          path={`/matchmaking/proposals/${proposal.id}/accept`}
          label={ui.acceptance}
          redirectTo="/matches"
        />
        <CompetitionAction
          path={`/matchmaking/proposals/${proposal.id}/reject`}
          label={ui.rejection}
          redirectTo="/matchmaking"
          danger
        />
      </div>
    </Card>
  );
}
