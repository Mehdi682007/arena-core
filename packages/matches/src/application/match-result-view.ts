import type { MatchResultContext, MatchResultView } from '../domain/match-result-types';

export function toResultView(context: MatchResultContext, userId: string): MatchResultView {
  const mine = context.submissions.find(
    (submission) => submission.submittedByUserId === userId && submission.status !== 'SUPERSEDED',
  );
  const submission: MatchResultView['submission'] = {
    submitted: Boolean(mine),
    submittedAt: mine?.submittedAt ?? null,
    status:
      context.result?.status === 'CONFLICT'
        ? 'CONFLICT'
        : context.result?.status === 'CONFIRMED' || context.result?.status === 'ADMIN_RESOLVED'
          ? 'CONFIRMED'
          : mine
            ? 'SUBMITTED'
            : 'PENDING',
  };
  const result = context.result;
  if (!result || result.status === 'CONFLICT' || !result.resultPayload)
    return { status: result?.status === 'CONFLICT' ? 'CONFLICT' : 'PENDING', submission };
  const winner = result.winnerParticipantId
    ? context.match.participants.find(
        (participant) => participant.id === result.winnerParticipantId,
      )
    : undefined;
  return {
    status: result.status,
    submission,
    outcome: result.resultPayload.outcome,
    scores: result.resultPayload.scores,
    ...(winner ? { winnerSide: winner.side } : {}),
    isDraw: result.isDraw,
    ...(result.confirmedAt ? { confirmedAt: result.confirmedAt } : {}),
  };
}
