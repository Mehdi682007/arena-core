import { MatchDisputeError } from './match-dispute-errors';
import type {
  MatchDisputeClaimPayload,
  MatchDisputeReasonCode,
  MatchDisputeResultSnapshot,
  MatchDisputeStatus,
  RequestedOutcome,
} from './match-dispute-types';
import { validateAndCanonicalizeResult } from './match-result-policies';
import type { MatchResultContext } from './match-result-types';

const reasons = [
  'SCORE_MISMATCH',
  'WRONG_WINNER',
  'OPPONENT_NO_SHOW',
  'OPPONENT_DISCONNECTED',
  'INVALID_RESULT_SUBMISSION',
  'RULESET_VIOLATION',
  'ACCOUNT_IDENTITY_ISSUE',
  'OTHER',
] as const;
const outcomes = ['KEEP_CURRENT_RESULT', 'REVERSE_WINNER', 'CORRECT_SCORE', 'VOID_MATCH'] as const;
export function validateClaim(
  reasonCode: MatchDisputeReasonCode,
  input: unknown,
  context: MatchResultContext,
): MatchDisputeClaimPayload {
  if (
    !reasons.includes(reasonCode) ||
    input === null ||
    typeof input !== 'object' ||
    Array.isArray(input)
  )
    throw new MatchDisputeError('MATCH_DISPUTE_OPEN_NOT_ALLOWED');
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (key) =>
        ![
          'schemaVersion',
          'statement',
          'requestedOutcome',
          'proposedResult',
          'evidenceIds',
        ].includes(key),
    )
  )
    throw new MatchDisputeError('MATCH_DISPUTE_OPEN_NOT_ALLOWED');
  if (
    value.schemaVersion !== 1 ||
    typeof value.statement !== 'string' ||
    !value.statement.trim() ||
    value.statement.length > 2000 ||
    !outcomes.includes(value.requestedOutcome as RequestedOutcome) ||
    !Array.isArray(value.evidenceIds) ||
    value.evidenceIds.length > 10 ||
    value.evidenceIds.some((id) => typeof id !== 'string') ||
    new Set(value.evidenceIds).size !== value.evidenceIds.length ||
    (reasonCode === 'OTHER' && value.statement.trim().length < 10)
  )
    throw new MatchDisputeError('MATCH_DISPUTE_OPEN_NOT_ALLOWED');
  const requestedOutcome = value.requestedOutcome as RequestedOutcome;
  if ((requestedOutcome === 'CORRECT_SCORE') !== (value.proposedResult !== undefined))
    throw new MatchDisputeError('MATCH_DISPUTE_OPEN_NOT_ALLOWED');
  const proposedResult =
    value.proposedResult === undefined
      ? undefined
      : validateAndCanonicalizeResult(value.proposedResult, context.match);
  return {
    schemaVersion: 1,
    statement: value.statement.trim(),
    requestedOutcome,
    ...(proposedResult ? { proposedResult } : {}),
    evidenceIds: value.evidenceIds as string[],
  };
}
const transitions: Record<MatchDisputeStatus, readonly MatchDisputeStatus[]> = {
  OPEN: ['AWAITING_RESPONSE', 'CANCELLED', 'REJECTED'],
  AWAITING_RESPONSE: ['UNDER_REVIEW', 'CANCELLED', 'EXPIRED'],
  UNDER_REVIEW: ['RESOLVED', 'REJECTED', 'EXPIRED'],
  RESOLVED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
};
export function assertDisputeTransition(from: MatchDisputeStatus, to: MatchDisputeStatus): void {
  if (!transitions[from].includes(to)) throw new MatchDisputeError('MATCH_DISPUTE_STATE_INVALID');
}
export function buildResultSnapshot(context: MatchResultContext): MatchDisputeResultSnapshot {
  return {
    schemaVersion: 1,
    matchStatus: context.match.status,
    resultStatus: context.result?.status ?? null,
    resultPayload: context.result?.resultPayload ?? null,
    confirmationMethod: context.result?.confirmationMethod ?? null,
    confirmedAt: context.result?.confirmedAt?.toISOString() ?? null,
    submissions: context.submissions.map((submission) => ({
      side:
        context.match.participants.find((p) => p.id === submission.participantId)?.side ?? 'SIDE_A',
      status: submission.status,
    })),
  };
}
