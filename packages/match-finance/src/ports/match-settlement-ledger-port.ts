import type {
  MatchSettlementReservation,
  MatchSettlementType,
} from '../domain/match-settlement-types';
export interface MatchSettlementLedgerPort {
  postSettlement(input: {
    matchId: string;
    type: Exclude<MatchSettlementType, 'ADMIN_CORRECTION'>;
    winnerParticipantId: string | null;
    reservations: readonly MatchSettlementReservation[];
    idempotencyKey: string;
    fingerprint: string;
    actorUserId: string;
    now: Date;
  }): Promise<{ transactionId: string }>;
  getEscrowBalance(matchId: string): Promise<bigint>;
}
