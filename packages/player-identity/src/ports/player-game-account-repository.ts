import type {
  AdminReviewInput,
  ClaimableGamePlatform,
  GameAccountReview,
  GameAccountStatus,
  UserGameAccountRecord,
} from '../domain/player-identity-types';

export interface CreateClaimRecord {
  readonly userId: string;
  readonly gameId: string;
  readonly gamePlatformId: string;
  readonly handle: string;
  readonly normalizedHandle: string;
  readonly displayHandle: string;
}
export interface PlayerGameAccountRepository {
  userCanClaim(userId: string): Promise<boolean>;
  listUserGameAccounts(userId: string): Promise<readonly UserGameAccountRecord[]>;
  findUserGameAccount(userId: string, accountId: string): Promise<UserGameAccountRecord | null>;
  findAccountForAdmin(accountId: string): Promise<UserGameAccountRecord | null>;
  findGamePlatformForClaim(
    gameId: string,
    gamePlatformId: string,
  ): Promise<ClaimableGamePlatform | null>;
  hasActiveUserPlatformClaim(userId: string, gamePlatformId: string): Promise<boolean>;
  hasActiveHandleClaim(gamePlatformId: string, normalizedHandle: string): Promise<boolean>;
  createGameAccountClaim(input: CreateClaimRecord): Promise<UserGameAccountRecord>;
  transitionUserAccount(
    userId: string,
    accountId: string,
    status: GameAccountStatus,
  ): Promise<void>;
  setPrimaryGameAccount(userId: string, accountId: string, gameId: string): Promise<void>;
  resubmitRejectedAccount(
    userId: string,
    accountId: string,
    handle?: CreateClaimRecord,
  ): Promise<UserGameAccountRecord>;
  listAccountsForAdmin(status?: GameAccountStatus): Promise<readonly UserGameAccountRecord[]>;
  applyAdminReview(input: AdminReviewInput, status: GameAccountStatus): Promise<void>;
  listReviews(accountId: string): Promise<readonly GameAccountReview[]>;
}
