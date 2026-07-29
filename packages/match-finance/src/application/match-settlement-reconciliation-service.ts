import type { MatchSettlementLedgerPort } from '../ports/match-settlement-ledger-port';
import type { MatchSettlementRepository } from '../ports/match-settlement-repository';
export class MatchSettlementReconciliationService {
  public constructor(
    private readonly repository: MatchSettlementRepository,
    private readonly ledger: MatchSettlementLedgerPort,
  ) {}
  public async reconcile(matchId: string) {
    const settlement = await this.repository.getSettlementForAdmin(matchId);
    const escrowBalance = await this.ledger.getEscrowBalance(matchId);
    const expectedBalance = settlement?.status === 'FAILED' || !settlement ? escrowBalance : 0n;
    return {
      consistent: escrowBalance === expectedBalance,
      escrowBalance,
      expectedBalance,
      difference: escrowBalance - expectedBalance,
      autoFixed: false as const,
    };
  }
}
