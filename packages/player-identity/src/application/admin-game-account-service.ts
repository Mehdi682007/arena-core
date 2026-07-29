import { PlayerIdentityError } from '../domain/player-identity-errors';
import {
  assertGameAccountTransition,
  assertReviewReason,
  statusForReview,
} from '../domain/player-identity-policies';
import type {
  AdminReviewInput,
  GameAccountReview,
  GameAccountStatus,
  UserGameAccountRecord,
} from '../domain/player-identity-types';
import type { PlayerGameAccountRepository } from '../ports/player-game-account-repository';

export class AdminGameAccountVerificationService {
  public constructor(private readonly repository: PlayerGameAccountRepository) {}
  public listPendingGameAccounts(status: GameAccountStatus = 'PENDING') {
    return this.repository.listAccountsForAdmin(status);
  }
  public async getGameAccount(accountId: string): Promise<UserGameAccountRecord> {
    const account = await this.repository.findAccountForAdmin(accountId);
    if (!account) throw new PlayerIdentityError('GAME_ACCOUNT_NOT_FOUND');
    return account;
  }
  public async review(input: AdminReviewInput): Promise<void> {
    const account = await this.getGameAccount(input.accountId);
    const status = statusForReview(input.action);
    assertGameAccountTransition(account.status, status);
    assertReviewReason(input.action, input.reasonCode, input.note);
    await this.repository.applyAdminReview(input, status);
  }
  public getGameAccountReviewHistory(accountId: string): Promise<readonly GameAccountReview[]> {
    return this.repository.listReviews(accountId);
  }
}
