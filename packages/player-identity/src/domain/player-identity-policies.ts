import { PlayerIdentityError } from './player-identity-errors';
import type {
  GameAccountRejectionReasonCode,
  GameAccountSuspensionReasonCode,
} from '@arena-core/contracts';
import type { GameAccountReviewAction, GameAccountStatus } from './player-identity-types';

const transitions: Record<GameAccountStatus, readonly GameAccountStatus[]> = {
  DRAFT: ['PENDING', 'DISCONNECTED'],
  PENDING: ['VERIFIED', 'REJECTED', 'CHANGES_REQUESTED', 'DISCONNECTED'],
  VERIFIED: ['SUSPENDED', 'DISCONNECTED'],
  REJECTED: ['PENDING', 'DISCONNECTED'],
  CHANGES_REQUESTED: ['PENDING', 'DISCONNECTED'],
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
    CREATE: 'DRAFT',
    UPDATE: 'DRAFT',
    VERIFY: 'VERIFIED',
    REJECT: 'REJECTED',
    REQUEST_CHANGES: 'CHANGES_REQUESTED',
    SUSPEND: 'SUSPENDED',
    RESTORE: 'VERIFIED',
    DISCONNECT: 'DISCONNECTED',
    SUBMIT: 'PENDING',
    DELETE: 'DISCONNECTED',
    RESTORE_BY_USER: 'DRAFT',
    PRIMARY_CHANGE: 'VERIFIED',
  }[action] as GameAccountStatus;
}
const rejectionReasons = new Set<string>([
  'HANDLE_NOT_FOUND',
  'OWNERSHIP_NOT_PROVEN',
  'DUPLICATE_ACCOUNT',
  'INVALID_PLATFORM',
  'INSUFFICIENT_INFORMATION',
  'OTHER',
] satisfies readonly GameAccountRejectionReasonCode[]);
const suspensionReasons = new Set<string>([
  'OWNERSHIP_DISPUTE',
  'ACCOUNT_TRANSFERRED',
  'POLICY_VIOLATION',
  'SECURITY_REVIEW',
  'OTHER',
] satisfies readonly GameAccountSuspensionReasonCode[]);
export function assertReviewReason(
  action: GameAccountReviewAction,
  reasonCode?: string,
  note?: string,
): void {
  const required = action === 'REJECT' || action === 'REQUEST_CHANGES' || action === 'SUSPEND';
  const allowed: ReadonlySet<string> =
    action === 'REJECT' || action === 'REQUEST_CHANGES' ? rejectionReasons : suspensionReasons;
  if (
    (required && (reasonCode === undefined || !allowed.has(reasonCode))) ||
    (reasonCode === 'OTHER' && !note?.trim()) ||
    (note !== undefined && (note.trim().length === 0 || note.length > 500))
  )
    throw new PlayerIdentityError('GAME_ACCOUNT_VERIFICATION_INVALID');
}
