import type { AdminOperationRepository } from '../ports/admin-operation-repository';
export class AdminTimelineService {
  public constructor(private readonly repository: AdminOperationRepository) {}
  public user(id: string, limit = 100) {
    return this.repository.userTimeline(id, Math.min(Math.max(limit, 1), 100));
  }
  public match(id: string, limit = 100) {
    return this.repository.matchTimeline(id, Math.min(Math.max(limit, 1), 100));
  }
}
