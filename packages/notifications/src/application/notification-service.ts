import { NotificationError } from '../domain/notification-errors';
import {
  deduplicationKey,
  defaultPreference,
  normalizeLocale,
  sha256,
  validatePayload,
} from '../domain/notification-policies';
import { renderNotificationTemplate } from '../domain/notification-template-registry';
import type {
  CreateNotificationInput,
  NotificationRecord,
  NotificationView,
} from '../domain/notification-types';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { NotificationRepository } from '../ports/notification-repository';
import type { NotificationTransactionManager } from '../ports/notification-transaction-manager';

const view = (record: NotificationRecord): NotificationView => ({
  id: record.id,
  type: record.type,
  priority: record.priority,
  subject: record.subject,
  body: record.body,
  data: record.payload.data,
  read: record.readAt !== null,
  archived: record.archivedAt !== null,
  createdAt: record.createdAt,
  expiresAt: record.expiresAt,
});

export class NotificationService {
  public constructor(
    private readonly repository: NotificationRepository,
    private readonly transactions: NotificationTransactionManager<NotificationRepository>,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  public async create(input: CreateNotificationInput): Promise<NotificationView> {
    const payload = validatePayload(input.payload);
    const locale = normalizeLocale(input.locale);
    const rendered = renderNotificationTemplate(input.type, locale, payload);
    const key = deduplicationKey(input);
    const payloadHash = sha256(payload);
    return this.transactions.transaction(async (repository) => {
      const existing = await repository.findByDeduplicationKey(key);
      if (existing) {
        if (existing.payloadHash !== payloadHash)
          throw new NotificationError('NOTIFICATION_DEDUPLICATION_CONFLICT');
        return view(existing);
      }
      if (!(await repository.recipientExists(input.recipientUserId)))
        throw new NotificationError('NOTIFICATION_OWNERSHIP_INVALID');
      const override = await repository.findPreference(input.recipientUserId, input.type);
      const preference = override ?? defaultPreference(input.type);
      const channels = [
        ...(preference.inAppEnabled ? (['IN_APP'] as const) : []),
        ...(preference.emailEnabled ? (['EMAIL'] as const) : []),
      ];
      const now = this.clock.now();
      const record: NotificationRecord = {
        id: this.ids.generate(),
        recipientUserId: input.recipientUserId,
        type: input.type,
        schemaVersion: 1,
        priority: rendered.priority,
        locale,
        subject: rendered.subject,
        body: rendered.body,
        payload,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        deduplicationKey: key,
        payloadHash,
        createdAt: now,
        readAt: null,
        archivedAt: null,
        expiresAt: input.expiresAt ?? null,
        version: 1,
      };
      const created = await repository.createNotificationWithOutbox({
        notification: record,
        channels,
        outboxIds: { IN_APP: this.ids.generate(), EMAIL: this.ids.generate() },
        availableAt: now,
      });
      return view(created);
    });
  }

  public async list(
    userId: string,
    query: Omit<Parameters<NotificationRepository['listNotificationsForUser']>[1], 'now'>,
  ) {
    const result = await this.repository.listNotificationsForUser(userId, {
      ...query,
      now: this.clock.now(),
    });
    return { items: result.items.map(view), nextCursor: result.nextCursor };
  }
  public unreadCount(userId: string) {
    return this.repository
      .countUnreadForUser(userId, this.clock.now())
      .then((count) => ({ count }));
  }
  public async detail(userId: string, notificationId: string) {
    const item = await this.repository.findNotificationForUser(userId, notificationId);
    if (!item) throw new NotificationError('NOTIFICATION_NOT_FOUND');
    return view(item);
  }
  public async markRead(userId: string, id: string) {
    return view(await this.repository.setReadState(userId, id, this.clock.now()));
  }
  public async markUnread(userId: string, id: string) {
    return view(await this.repository.setReadState(userId, id, null));
  }
  public async archive(userId: string, id: string) {
    return view(await this.repository.archive(userId, id, this.clock.now()));
  }
}
