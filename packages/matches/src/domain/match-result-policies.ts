import { MatchResultError } from './match-result-errors';
import type {
  MatchResultOutcome,
  MatchResultPayload,
  MatchResultResolutionReasonCode,
} from './match-result-types';
import type { MatchRecord, RulesetSnapshot } from './match-types';

const MAX_SCORE = 99;
function plainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}
function drawAllowed(snapshot: RulesetSnapshot): boolean {
  const config = snapshot.configuration;
  if (!plainObject(config)) return true;
  if (typeof config.drawAllowed === 'boolean') return config.drawAllowed;
  const settings = config.settings;
  if (plainObject(settings)) {
    if (typeof settings.drawAllowed === 'boolean') return settings.drawAllowed;
    if (settings.extraTime === true || settings.penalties === true) return false;
  }
  return true;
}
export function validateAndCanonicalizeResult(
  input: unknown,
  match: Pick<MatchRecord, 'rulesetSnapshot'>,
): MatchResultPayload {
  if (
    !plainObject(input) ||
    Object.keys(input).some((key) => !['schemaVersion', 'type', 'scores', 'outcome'].includes(key))
  )
    throw new MatchResultError('MATCH_RESULT_INVALID');
  if (input.schemaVersion !== 1 || input.type !== 'SCORE' || !Array.isArray(input.scores))
    throw new MatchResultError('MATCH_RESULT_INVALID');
  if (input.scores.length !== 2) throw new MatchResultError('MATCH_RESULT_INVALID');
  const scores = input.scores
    .map((candidate) => {
      if (
        !plainObject(candidate) ||
        Object.keys(candidate).some((key) => !['side', 'score'].includes(key))
      )
        throw new MatchResultError('MATCH_RESULT_INVALID');
      if (
        !['SIDE_A', 'SIDE_B'].includes(String(candidate.side)) ||
        !Number.isInteger(candidate.score) ||
        Number(candidate.score) < 0 ||
        Number(candidate.score) > MAX_SCORE
      )
        throw new MatchResultError('MATCH_RESULT_INVALID');
      return { side: candidate.side as 'SIDE_A' | 'SIDE_B', score: Number(candidate.score) };
    })
    .sort((left, right) => left.side.localeCompare(right.side));
  if (scores[0]?.side !== 'SIDE_A' || scores[1]?.side !== 'SIDE_B')
    throw new MatchResultError('MATCH_RESULT_INVALID');
  const equal = scores[0].score === scores[1].score;
  const outcome = equal ? 'DRAW' : 'WIN_LOSS';
  if (input.outcome !== undefined && input.outcome !== outcome)
    throw new MatchResultError('MATCH_RESULT_INVALID');
  if (equal && !drawAllowed(match.rulesetSnapshot.data))
    throw new MatchResultError('MATCH_RESULT_INVALID');
  return Object.freeze({
    schemaVersion: 1,
    type: 'SCORE',
    scores: Object.freeze(scores),
    outcome,
  });
}
export function sameCanonicalResult(left: MatchResultPayload, right: MatchResultPayload): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
export function deriveOutcome(payload: MatchResultPayload, match: MatchRecord): MatchResultOutcome {
  if (payload.outcome === 'DRAW')
    return { winnerParticipantId: null, loserParticipantId: null, isDraw: true };
  const [a, b] = payload.scores;
  if (!a || !b) throw new MatchResultError('MATCH_RESULT_INVALID');
  const winnerSide = a.score > b.score ? a.side : b.side;
  const winner = match.participants.find((participant) => participant.side === winnerSide);
  const loser = match.participants.find((participant) => participant.side !== winnerSide);
  if (!winner || !loser) throw new MatchResultError('MATCH_RESULT_INVALID');
  return { winnerParticipantId: winner.id, loserParticipantId: loser.id, isDraw: false };
}
export function validateResolutionInput(
  reasonCode: MatchResultResolutionReasonCode,
  note?: string,
): void {
  if (!['SUBMISSION_ERROR', 'OPERATIONAL_CORRECTION', 'OTHER'].includes(reasonCode))
    throw new MatchResultError('MATCH_RESULT_RESOLUTION_INVALID');
  if ((reasonCode === 'OTHER' && !note?.trim()) || (note !== undefined && note.trim().length > 500))
    throw new MatchResultError('MATCH_RESULT_RESOLUTION_INVALID');
}
