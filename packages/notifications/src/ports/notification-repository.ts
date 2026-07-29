import type {
  NotificationChannel,
  NotificationPreferenceRecord,
  NotificationRecord,
  NotificationType,
} from '../domain/notification-types';
import type {
  NotificationDeliveryAttemptRecord,
  NotificationDeliveryAttemptStatus,
  NotificationOutboxRecord,
  NotificationOutboxStatus,
} from '../domain/outbox-types';

export interface CreateNotificationPersistenceInput {
  readonly notification: NotificationRecord;
  readonly channels: readonly NotificationChannel[];
  readonly outboxIds: Readonly<Record<NotificationChannel, string>>;
  readonly availableAt: Date;
}
export interface NotificationListQuery {
  readonly cursor?: string;
  readonly limit: number;
  readonly archived?: boolean;
  readonly unread?: boolean;
  readonly type?: NotificationType;
  readonly now: Date;
}
export interface PreferenceUpdateInput {
  readonly id: string;
  readonly userId: string;
  readonly type: NotificationType;
  readonly inAppEnabled: boolean;
  readonly emailEnabled: boolean;
  readonly expectedVersion?: number;
  readonly now: Date;
}
export interface DeliveryAttemptInput {
  readonly id: string;
  readonly outboxMessageId: string;
  readonly attemptNumber: number;
  readonly status: NotificationDeliveryAttemptStatus;
  readonly provider: string;
  readonly providerMessageId?: string;
  readonly errorCode?: string;
  readonly errorCategory?: string;
  readonly startedAt: Date;
  readonly completedAt: Date;
}
export interface AdminOutboxQuery {
  readonly status?: NotificationOutboxStatus;
  readonly channel?: NotificationChannel;
  readonly type?: NotificationType;
  readonly createdFrom?: Date;
  readonly createdTo?: Date;
  readonly attemptMin?: number;
  readonly cursor?: string;
  readonly limit: number;
}

export interface NotificationRepository {
  recipientExists(userId: string): Promise<boolean>;
  findByDeduplicationKey(key: string): Promise<NotificationRecord | null>;
  createNotificationWithOutbox(
    input: CreateNotificationPersistenceInput,
  ): Promise<NotificationRecord>;
  listNotificationsForUser(
    userId: string,
    query: NotificationListQuery,
  ): Promise<Readonly<{ items: readonly NotificationRecord[]; nextCursor: string | null }>>;
  countUnreadForUser(userId: string, now: Date): Promise<number>;
  findNotificationForUser(
    userId: string,
    notificationId: string,
  ): Promise<NotificationRecord | null>;
  setReadState(
    userId: string,
    notificationId: string,
    readAt: Date | null,
  ): Promise<NotificationRecord>;
  archive(userId: string, notificationId: string, now: Date): Promise<NotificationRecord>;
  findPreference(
    userId: string,
    type: NotificationType,
  ): Promise<NotificationPreferenceRecord | null>;
  updatePreference(input: PreferenceUpdateInput): Promise<NotificationPreferenceRecord>;
  listPreferencesForUser(userId: string): Promise<readonly NotificationPreferenceRecord[]>;
  findOutboxMessage(id: string): Promise<NotificationOutboxRecord | null>;
  claimPendingMessages(
    now: Date,
    limit: number,
    leaseSeconds: number,
    claimToken: string,
  ): Promise<readonly NotificationOutboxRecord[]>;
  releaseExpiredClaims(now: Date, limit: number): Promise<number>;
  appendDeliveryAttempt(input: DeliveryAttemptInput): Promise<NotificationDeliveryAttemptRecord>;
  markDelivered(id: string, expectedVersion: number, now: Date): Promise<NotificationOutboxRecord>;
  scheduleRetry(
    id: string,
    expectedVersion: number,
    now: Date,
    availableAt: Date,
    errorCode: string,
  ): Promise<NotificationOutboxRecord>;
  markDeadLettered(
    id: string,
    expectedVersion: number,
    now: Date,
    errorCode: string,
  ): Promise<NotificationOutboxRecord>;
  cancelOutbox(
    id: string,
    expectedVersion: number,
    now: Date,
    reasonCode: string,
  ): Promise<NotificationOutboxRecord>;
  listOutboxForAdmin(
    query: AdminOutboxQuery,
  ): Promise<Readonly<{ items: readonly NotificationOutboxRecord[]; nextCursor: string | null }>>;
  retryOutboxMessage(id: string, now: Date): Promise<NotificationOutboxRecord>;
}
