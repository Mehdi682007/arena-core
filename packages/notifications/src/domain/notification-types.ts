export const notificationTypes = [
  'MATCHMAKING_PROPOSAL_CREATED',
  'MATCHMAKING_PROPOSAL_ACCEPTED',
  'MATCH_READY_REQUIRED',
  'MATCH_STARTED',
  'MATCH_RESULT_WAITING',
  'MATCH_RESULT_CONFIRMED',
  'MATCH_RESULT_CONFLICT',
  'MATCH_DISPUTE_OPENED',
  'MATCH_DISPUTE_RESPONSE_RECEIVED',
  'MATCH_DISPUTE_RESOLVED',
  'MATCH_SETTLEMENT_COMPLETED',
  'RATING_UPDATED',
  'SECURITY_SIGN_IN',
] as const;
export type NotificationType = (typeof notificationTypes)[number];
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type NotificationChannel = 'IN_APP' | 'EMAIL';
export type NotificationLocale = 'fa' | 'en';
export type NotificationSourceType =
  | 'MATCHMAKING_PROPOSAL'
  | 'MATCH'
  | 'MATCH_RESULT'
  | 'MATCH_DISPUTE'
  | 'MATCH_SETTLEMENT'
  | 'RATING_APPLICATION'
  | 'SECURITY_EVENT';

export interface NotificationPayloadEnvelope {
  readonly schemaVersion: 1;
  readonly data: Readonly<Record<string, string | number | boolean | null>>;
}

export interface NotificationRecord {
  readonly id: string;
  readonly recipientUserId: string;
  readonly type: NotificationType;
  readonly schemaVersion: 1;
  readonly priority: NotificationPriority;
  readonly locale: NotificationLocale;
  readonly subject: string;
  readonly body: string;
  readonly payload: NotificationPayloadEnvelope;
  readonly sourceType: NotificationSourceType;
  readonly sourceId: string;
  readonly deduplicationKey: string;
  readonly payloadHash: string;
  readonly createdAt: Date;
  readonly readAt: Date | null;
  readonly archivedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly version: number;
}

export interface NotificationView {
  readonly id: string;
  readonly type: NotificationType;
  readonly priority: NotificationPriority;
  readonly subject: string;
  readonly body: string;
  readonly data: Readonly<Record<string, string | number | boolean | null>>;
  readonly read: boolean;
  readonly archived: boolean;
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
}

export interface NotificationPreferenceRecord {
  readonly id: string;
  readonly userId: string;
  readonly type: NotificationType;
  readonly inAppEnabled: boolean;
  readonly emailEnabled: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NotificationPreferenceView {
  readonly type: NotificationType;
  readonly inAppEnabled: boolean;
  readonly emailEnabled: boolean;
  readonly requiredChannels: readonly NotificationChannel[];
}

export interface CreateNotificationInput {
  readonly recipientUserId: string;
  readonly type: NotificationType;
  readonly schemaVersion: 1;
  readonly locale?: string;
  readonly payload: NotificationPayloadEnvelope;
  readonly sourceType: NotificationSourceType;
  readonly sourceId: string;
  readonly eventVersion?: number;
  readonly expiresAt?: Date;
}
