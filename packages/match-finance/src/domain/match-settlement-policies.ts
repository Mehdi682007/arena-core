import { createHash } from 'node:crypto';
import type {
  MatchSettlementContext,
  MatchSettlementRecord,
  MatchSettlementView,
  SettlementEligibility,
} from './match-settlement-types';

export function evaluateMatchSettlementEligibility(
  context: MatchSettlementContext,
  now: Date,
): SettlementEligibility {
  const reasons: SettlementEligibility['reasons'][number][] = [];
  let type: SettlementEligibility['type'] = null;
  if (context.settlementExists) reasons.push('SETTLEMENT_ALREADY_EXISTS');
  if (context.reservations.length !== 2) reasons.push('PARTICIPANT_COUNT_INVALID');
  if (context.reservations.some((item) => item.assetCode !== 'ARENA_POINT'))
    reasons.push('ASSET_MISMATCH');
  if (context.activeDispute) reasons.push('ACTIVE_DISPUTE_EXISTS');
  if (context.matchStatus === 'VOIDED') {
    type = 'VOID_REFUND';
    if (context.reservations.some((item) => !['RELEASED', 'RESERVED'].includes(item.status)))
      reasons.push(
        context.reservations.some((item) => item.status === 'REFUNDED')
          ? 'RESERVATION_ALREADY_REFUNDED'
          : 'RESERVATION_NOT_RELEASED',
      );
  } else {
    if (context.matchStatus !== 'COMPLETED') reasons.push('MATCH_NOT_FINAL');
    if (!['CONFIRMED', 'ADMIN_RESOLVED'].includes(context.resultStatus ?? ''))
      reasons.push('RESULT_NOT_FINAL');
    if (context.reservations.some((item) => item.status !== 'RELEASED'))
      reasons.push(
        context.reservations.some((item) => item.status === 'REFUNDED')
          ? 'RESERVATION_ALREADY_REFUNDED'
          : 'RESERVATION_NOT_RELEASED',
      );
    type = context.isDraw ? 'DRAW_REFUND' : 'WINNER_TAKES_ALL';
    if (
      type === 'WINNER_TAKES_ALL' &&
      !context.reservations.some((item) => item.participantId === context.winnerParticipantId)
    )
      reasons.push('WINNER_NOT_PARTICIPANT');
    const eligibleAt = context.terminalDisputeResolvedAt ?? context.settlementEligibleAt;
    if (!eligibleAt || eligibleAt > now) reasons.push('SETTLEMENT_DELAY_NOT_ELAPSED');
  }
  const expected = context.reservations.reduce((sum, item) => sum + item.amount, 0n);
  if (context.escrowBalance !== expected) reasons.push('ESCROW_BALANCE_MISMATCH');
  return { eligible: reasons.length === 0, type: reasons.length === 0 ? type : null, reasons };
}

export function settlementFingerprint(input: {
  matchId: string;
  resultId: string | null;
  resultVersion: number | null;
  type: string;
  total: bigint;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        operation: 'MATCH_SETTLEMENT',
        matchId: input.matchId,
        resultId: input.resultId,
        resultVersion: input.resultVersion,
        type: input.type,
        total: input.total.toString(),
      }),
    )
    .digest('hex');
}

export function toSettlementView(
  settlement: MatchSettlementRecord,
  participantId: string,
  ownAmount: bigint,
): MatchSettlementView {
  const received =
    settlement.type === 'WINNER_TAKES_ALL'
      ? settlement.winnerParticipantId === participantId
        ? settlement.distributedAmount
        : 0n
      : ownAmount;
  return {
    matchId: settlement.matchId,
    status: settlement.status,
    type: settlement.type,
    asset: { code: 'ARENA_POINT', monetary: false, withdrawable: false },
    totalAmount: settlement.totalEscrowAmount.toString(),
    receivedAmount: received.toString(),
    settledAt: settlement.settledAt,
  };
}
