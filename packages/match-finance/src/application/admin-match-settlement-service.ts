import type { MatchSettlementRecord } from '../domain/match-settlement-types';
import type { MatchSettlementRepository } from '../ports/match-settlement-repository';
import type { MatchSettlementService } from './match-settlement-service';
export class AdminMatchSettlementService {
  public constructor(
    private readonly service: MatchSettlementService,
    private readonly repository: MatchSettlementRepository,
    private readonly delaySeconds = 86_400,
  ) {}
  public settle(matchId: string, idempotencyKey: string, actorUserId: string) {
    return this.service.settle({ matchId, idempotencyKey, actorUserId, operation: 'SYSTEM' });
  }
  public retry(matchId: string, idempotencyKey: string, actorUserId: string) {
    return this.service.settle({ matchId, idempotencyKey, actorUserId, operation: 'ADMIN_RETRY' });
  }
  public inspect(matchId: string): Promise<MatchSettlementRecord | null> {
    return this.repository.getSettlementForAdmin(matchId);
  }
  public list(limit = 50) {
    return this.repository.listSettlementsForAdmin(Math.min(Math.max(limit, 1), 100));
  }
  public listEligible(now: Date, limit = 50) {
    return this.repository.listEligibleMatches(
      new Date(now.getTime() - this.delaySeconds * 1000),
      Math.min(Math.max(limit, 1), 100),
    );
  }
}
