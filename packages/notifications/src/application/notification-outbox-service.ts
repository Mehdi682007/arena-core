import type { NotificationDeliveryPolicy } from '../domain/delivery-policies';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { AdminOutboxQuery, NotificationRepository } from '../ports/notification-repository';

export class NotificationOutboxService {
  public constructor(
    private readonly repository: NotificationRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly policy: NotificationDeliveryPolicy,
  ) {}
  public claim(limit: number) {
    return this.repository.claimPendingMessages(
      this.clock.now(),
      Math.min(Math.max(limit, 1), 100),
      this.policy.claimLeaseSeconds,
      this.ids.generate(),
    );
  }
  public releaseExpiredClaims(limit: number) {
    return this.repository.releaseExpiredClaims(
      this.clock.now(),
      Math.min(Math.max(limit, 1), 100),
    );
  }
  public listAdmin(query: AdminOutboxQuery) {
    return this.repository.listOutboxForAdmin({ ...query, limit: Math.min(query.limit, 100) });
  }
  public detail(id: string) {
    return this.repository.findOutboxMessage(id);
  }
  public retry(id: string) {
    return this.repository.retryOutboxMessage(id, this.clock.now());
  }
}
