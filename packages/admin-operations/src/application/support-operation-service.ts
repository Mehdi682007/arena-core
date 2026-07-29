import type { AuditQueryService } from './audit-query-service';
export interface NotificationSupportPort {
  retry(id: string): Promise<unknown>;
  recover(sourceType: string, sourceId: string): Promise<boolean>;
}
export class SupportOperationService {
  public constructor(
    private readonly notifications: NotificationSupportPort,
    private readonly audit: AuditQueryService,
    private readonly ids: { generate(): string },
    private readonly clock: { now(): Date },
  ) {}
  public async retry(actorUserId: string, id: string) {
    await this.audit.append({
      id: this.ids.generate(),
      actorUserId,
      actorType: 'SUPPORT',
      action: 'NOTIFICATION_RETRY_REQUESTED',
      targetType: 'NOTIFICATION_OUTBOX',
      targetId: id,
      source: 'ADMIN_SUPPORT',
      createdAt: this.clock.now(),
      metadata: { requested: true },
    });
    return this.notifications.retry(id);
  }
  public async recover(actorUserId: string, sourceType: string, sourceId: string) {
    await this.audit.append({
      id: this.ids.generate(),
      actorUserId,
      actorType: 'SUPPORT',
      action: 'NOTIFICATION_RECOVERY_STARTED',
      targetType: sourceType,
      targetId: sourceId,
      source: 'ADMIN_SUPPORT',
      createdAt: this.clock.now(),
      metadata: { requested: true },
    });
    return { recovered: await this.notifications.recover(sourceType, sourceId) };
  }
}
