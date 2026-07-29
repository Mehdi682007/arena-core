import { MatchError } from './match-errors';
import type { MatchStatus, MatchVoidReasonCode } from './match-types';

const transitions: Record<MatchStatus, readonly MatchStatus[]> = {
  CREATED: ['AWAITING_READY', 'CANCELLED', 'VOIDED'],
  AWAITING_READY: ['READY', 'CANCELLED', 'EXPIRED', 'VOIDED'],
  READY: ['IN_PROGRESS', 'VOIDED'],
  IN_PROGRESS: ['AWAITING_RESULT', 'VOIDED'],
  AWAITING_RESULT: ['COMPLETED', 'RESULT_CONFLICT', 'VOIDED'],
  RESULT_CONFLICT: ['COMPLETED', 'VOIDED'],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
  VOIDED: [],
};
export function assertMatchTransition(from: MatchStatus, to: MatchStatus): void {
  if (!transitions[from].includes(to)) throw new MatchError('MATCH_STATE_TRANSITION_INVALID');
}
export function validateVoidInput(input: { reasonCode: MatchVoidReasonCode; note?: string }): void {
  if (input.note !== undefined && (input.note.length > 500 || input.note.trim() !== input.note))
    throw new MatchError('MATCH_STATE_TRANSITION_INVALID');
  if (input.reasonCode === 'OTHER' && !input.note)
    throw new MatchError('MATCH_STATE_TRANSITION_INVALID');
}
