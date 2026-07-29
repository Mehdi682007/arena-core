import { NotificationError } from '../domain/notification-errors';
import type { AdminOutboxQuery, NotificationRepository } from '../ports/notification-repository';
import type { Clock } from '../ports/clock';

export class AdminNotificationService {
  public constructor(
    private readonly repository: NotificationRepository,
    private readonly clock: Clock,
  ) {}
  public list(query: AdminOutboxQuery) {
    return this.repository.listOutboxForAdmin({ ...query, limit: Math.min(query.limit, 100) });
  }
  public async detail(id: string) {
    const item = await this.repository.findOutboxMessage(id);
    if (!item) throw new NotificationError('NOTIFICATION_OUTBOX_NOT_FOUND');
    return item;
  }
  public deadLetter(limit: number) {
    return this.repository.listOutboxForAdmin({
      status: 'DEAD_LETTERED',
      limit: Math.min(limit, 100),
    });
  }
  public retry(id: string) {
    return this.repository.retryOutboxMessage(id, this.clock.now());
  }
  public releaseClaims(limit: number) {
    return this.repository.releaseExpiredClaims(this.clock.now(), Math.min(limit, 100));
  }
}
