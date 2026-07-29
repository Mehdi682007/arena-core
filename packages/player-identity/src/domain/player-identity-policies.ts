import { PlayerIdentityError } from './player-identity-errors';
import type { GameAccountReviewAction, GameAccountStatus } from './player-identity-types';

const transitions: Record<GameAccountStatus, readonly GameAccountStatus[]> = {
  PENDING: ['VERIFIED', 'REJECTED', 'DISCONNECTED'],
  VERIFIED: ['SUSPENDED', 'DISCONNECTED'],
  REJECTED: ['PENDING', 'DISCONNECTED'],
  SUSPENDED: ['VERIFIED', 'DISCONNECTED'],
  DISCONNECTED: [],
};
export function assertGameAccountTransition(from: GameAccountStatus, to: GameAccountStatus): void {
  if (from !== to && !transitions[from].includes(to))
    throw new PlayerIdentityError('GAME_ACCOUNT_STATUS_TRANSITION_INVALID');
}
export function assertPrimaryEligible(status: GameAccountStatus): void {
  if (status !== 'VERIFIED') throw new PlayerIdentityError('GAME_ACCOUNT_NOT_VERIFIED');
}
export function statusForReview(action: GameAccountReviewAction): GameAccountStatus {
  return {
    VERIFY: 'VERIFIED',
    REJECT: 'REJECTED',
    SUSPEND: 'SUSPENDED',
    RESTORE: 'VERIFIED',
    DISCONNECT: 'DISCONNECTED',
  }[action] as GameAccountStatus;
}
const rejectionReasons = new Set([
  'HANDLE_NOT_FOUND',
  'OWNERSHIP_NOT_PROVEN',
  'DUPLICATE_ACCOUNT',
  'INVALID_PLATFORM',
  'INSUFFICIENT_INFORMATION',
  'OTHER',
]);
const suspensionReasons = new Set([
  'OWNERSHIP_DISPUTE',
  'ACCOUNT_TRANSFERRED',
  'POLICY_VIOLATION',
  'SECURITY_REVIEW',
  'OTHER',
]);
export function assertReviewReason(
  action: GameAccountReviewAction,
  reasonCode?: string,
  note?: string,
): void {
  const required = action === 'REJECT' || action === 'SUSPEND';
  const allowed = action === 'REJECT' ? rejectionReasons : suspensionReasons;
  if (
    (required && (reasonCode === undefined || !allowed.has(reasonCode))) ||
    (reasonCode === 'OTHER' && !note?.trim()) ||
    (note !== undefined && (note.trim().length === 0 || note.length > 500))
  )
    throw new PlayerIdentityError('GAME_ACCOUNT_VERIFICATION_INVALID');
}
