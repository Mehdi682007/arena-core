import { MatchmakingError } from '../domain/matchmaking-errors';
import { validateCriteria } from '../domain/matchmaking-policies';
import type {
  MatchmakingRequest,
  MatchmakingRequestView,
  MatchmakingSearchScope,
} from '../domain/matchmaking-types';
import type { Clock } from '../ports/clock';
import type { MatchmakingRepository } from '../ports/matchmaking-repository';
import type { MatchmakingEngine } from './matchmaking-engine';

const view = (request: MatchmakingRequest): MatchmakingRequestView => ({
  id: request.id,
  status: request.status,
  searchScope: request.searchScope,
  expiresAt: request.expiresAt,
  createdAt: request.createdAt,
});
export class MatchmakingRequestService {
  public constructor(
    private readonly repository: MatchmakingRepository,
    private readonly engine: MatchmakingEngine,
    private readonly clock: Clock,
    private readonly requestTtlSeconds = 900,
  ) {}
  public async listMyRequests(userId: string, limit = 50) {
    return (await this.repository.listUserRequests(userId, Math.min(Math.max(limit, 1), 100))).map(
      view,
    );
  }
  public async getMyRequest(userId: string, requestId: string) {
    const request = await this.repository.findRequestForUser(userId, requestId);
    if (!request) throw new MatchmakingError('MATCHMAKING_REQUEST_NOT_FOUND');
    return view(request);
  }
  public async createRequest(input: {
    userId: string;
    userGameAccountId: string;
    gameModeId: string;
    gameRulesetId: string;
    searchScope?: MatchmakingSearchScope;
    criteria?: unknown;
  }): Promise<MatchmakingRequestView> {
    if (await this.repository.findActiveRequestByUser(input.userId))
      throw new MatchmakingError('MATCHMAKING_ACTIVE_REQUEST_EXISTS');
    const context = await this.repository.resolveCreationContext(
      input.userId,
      input.userGameAccountId,
      input.gameModeId,
      input.gameRulesetId,
    );
    if (!context?.accountVerified) throw new MatchmakingError('MATCHMAKING_ACCOUNT_INVALID');
    if (!context.catalogValid) throw new MatchmakingError('MATCHMAKING_CATALOG_INVALID');
    const created = await this.repository.createRequest({
      ...context,
      searchScope: input.searchScope ?? 'CROSSPLAY_GROUP',
      criteria: validateCriteria({
        schemaVersion: 1,
        preferences: input.criteria ?? {},
      }),
      expiresAt: new Date(this.clock.now().getTime() + this.requestTtlSeconds * 1_000),
    });
    const searching = await this.repository.transitionRequest(
      created.id,
      created.version,
      'SEARCHING',
      this.clock.now(),
    );
    await this.engine.findBestCandidate(searching.id);
    return view((await this.repository.findRequestById(searching.id)) ?? searching);
  }
  public cancelMyRequest(userId: string, requestId: string): Promise<void> {
    return this.repository.cancelRequest(userId, requestId, this.clock.now());
  }
  public expireRequests(limit = 100): Promise<number> {
    return this.repository.expireRequests(this.clock.now(), Math.min(Math.max(limit, 1), 500));
  }
}
