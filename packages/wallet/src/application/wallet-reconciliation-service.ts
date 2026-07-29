import type { Clock } from '../ports/clock';
import type { WalletRepository } from '../ports/wallet-repository';

export class WalletReconciliationService {
  public constructor(
    private readonly repository: WalletRepository,
    private readonly clock: Clock,
  ) {}
  public reconcile(userId: string, actorUserId: string) {
    return this.repository.reconcile(userId, actorUserId, this.clock.now());
  }
}
