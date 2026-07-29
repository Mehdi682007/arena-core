import type { NotificationChannel, NotificationPayloadEnvelope } from './notification-types';

export type NotificationOutboxStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'DELIVERED'
  | 'RETRY_SCHEDULED'
  | 'FAILED'
  | 'DEAD_LETTERED'
  | 'CANCELLED';
export type NotificationDeliveryAttemptStatus =
  'SUCCEEDED' | 'RETRYABLE_FAILURE' | 'PERMANENT_FAILURE' | 'SKIPPED';

export interface NotificationOutboxRecord {
  readonly id: string;
  readonly notificationId: string;
  readonly channel: NotificationChannel;
  readonly status: NotificationOutboxStatus;
  readonly deduplicationKey: string;
  readonly availableAt: Date;
  readonly attemptCount: number;
  readonly lastAttemptAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly failedAt: Date | null;
  readonly deadLetteredAt: Date | null;
  readonly lastErrorCode: string | null;
  readonly payloadSnapshot: NotificationPayloadEnvelope;
  readonly claimToken: string | null;
  readonly claimExpiresAt: Date | null;
  readonly version: number;
  readonly notification: Readonly<{
    recipientUserId: string;
    type: string;
    subject: string;
    body: string;
    locale: string;
  }>;
}

export interface NotificationDeliveryAttemptRecord {
  readonly id: string;
  readonly outboxMessageId: string;
  readonly attemptNumber: number;
  readonly status: NotificationDeliveryAttemptStatus;
  readonly provider: string;
  readonly providerMessageId: string | null;
  readonly errorCode: string | null;
  readonly errorCategory: string | null;
  readonly startedAt: Date;
  readonly completedAt: Date;
}
