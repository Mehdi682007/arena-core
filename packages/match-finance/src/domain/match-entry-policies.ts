import { MatchFinanceError } from './match-entry-errors';
import type {
  MatchEntryRequirementSnapshot,
  MatchEntryReservationRecord,
  MatchEntryReservationView,
} from './match-entry-types';
import { MATCH_ENTRY_ASSET } from './match-entry-types';

const amountPattern = /^(0|[1-9]\d{0,12})$/;

export function parseRequirement(configuration: unknown): MatchEntryRequirementSnapshot {
  if (typeof configuration !== 'object' || configuration === null) {
    return {
      schemaVersion: 1,
      assetCode: 'ARENA_POINT',
      amountPerParticipant: '0',
      required: false,
    };
  }
  const entry = (configuration as { entryRequirement?: unknown }).entryRequirement;
  if (entry === undefined) {
    return {
      schemaVersion: 1,
      assetCode: 'ARENA_POINT',
      amountPerParticipant: '0',
      required: false,
    };
  }
  if (typeof entry !== 'object' || entry === null)
    throw new MatchFinanceError('MATCH_ENTRY_RESERVATION_MATCH_INVALID');
  const value = entry as {
    assetCode?: unknown;
    amountPerParticipant?: unknown;
    required?: unknown;
  };
  if (
    value.assetCode !== 'ARENA_POINT' ||
    typeof value.amountPerParticipant !== 'string' ||
    !amountPattern.test(value.amountPerParticipant)
  )
    throw new MatchFinanceError('MATCH_ENTRY_RESERVATION_MATCH_INVALID');
  const amount = BigInt(value.amountPerParticipant);
  const required = value.required === undefined ? amount > 0n : value.required;
  if (typeof required !== 'boolean' || (!required && amount !== 0n) || (required && amount === 0n))
    throw new MatchFinanceError('MATCH_ENTRY_RESERVATION_MATCH_INVALID');
  return {
    schemaVersion: 1,
    assetCode: 'ARENA_POINT',
    amountPerParticipant: value.amountPerParticipant,
    required,
  };
}

export function toReservationView(
  reservation: MatchEntryReservationRecord,
): MatchEntryReservationView {
  return {
    matchId: reservation.matchId,
    status: reservation.status,
    asset: MATCH_ENTRY_ASSET,
    amount: reservation.amount.toString(),
    reservedAt: reservation.reservedAt,
    releasedAt: reservation.releasedAt,
    refundedAt: reservation.refundedAt,
  };
}

export function assertEntrySatisfied(reservation: MatchEntryReservationRecord | null): void {
  if (
    reservation === null ||
    !['NOT_REQUIRED', 'RESERVED', 'RELEASED'].includes(reservation.status) ||
    reservation.expiresAt <= new Date()
  )
    throw new MatchFinanceError('MATCH_ENTRY_RESERVATION_STATE_INVALID');
}
