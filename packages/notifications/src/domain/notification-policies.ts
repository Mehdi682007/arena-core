import { createHash } from 'node:crypto';
import { NotificationError } from './notification-errors';
import {
  notificationTypes,
  type NotificationLocale,
  type NotificationPayloadEnvelope,
  type NotificationPreferenceView,
  type NotificationType,
} from './notification-types';

const forbidden =
  /(?:email|password|token|session|csrf|ip|walletId|opponentUserId|normalizedHandle|adminNote)/i;
const operational = new Set<NotificationType>(
  notificationTypes.filter((type) => !['RATING_UPDATED', 'SECURITY_SIGN_IN'].includes(type)),
);

export function normalizeLocale(locale: string | undefined): NotificationLocale {
  return locale === 'en' ? 'en' : 'fa';
}

export function validatePayload(payloadInput: unknown): NotificationPayloadEnvelope {
  if (typeof payloadInput !== 'object' || payloadInput === null || Array.isArray(payloadInput))
    throw new NotificationError('NOTIFICATION_PAYLOAD_INVALID');
  const candidate = payloadInput as { schemaVersion?: unknown; data?: unknown };
  if (
    candidate.schemaVersion !== 1 ||
    typeof candidate.data !== 'object' ||
    candidate.data === null ||
    Array.isArray(candidate.data) ||
    Object.keys(candidate.data).length > 16 ||
    JSON.stringify(candidate).length > 4096
  )
    throw new NotificationError('NOTIFICATION_PAYLOAD_INVALID');
  for (const [key, value] of Object.entries(candidate.data)) {
    if (
      forbidden.test(key) ||
      ['__proto__', 'prototype', 'constructor'].includes(key) ||
      !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(key) ||
      (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) ||
      (typeof value === 'string' && value.length > 500) ||
      (typeof value === 'number' && !Number.isFinite(value))
    )
      throw new NotificationError('NOTIFICATION_PAYLOAD_INVALID');
  }
  return Object.freeze({ schemaVersion: 1, data: Object.freeze({ ...candidate.data }) });
}

export function defaultPreference(type: NotificationType): NotificationPreferenceView {
  if (!notificationTypes.includes(type))
    throw new NotificationError('NOTIFICATION_PREFERENCE_INVALID');
  if (type === 'RATING_UPDATED')
    return { type, inAppEnabled: true, emailEnabled: false, requiredChannels: [] };
  if (type === 'SECURITY_SIGN_IN')
    return { type, inAppEnabled: true, emailEnabled: true, requiredChannels: ['IN_APP'] };
  return {
    type,
    inAppEnabled: true,
    emailEnabled: operational.has(type),
    requiredChannels: [],
  };
}

export function validatePreference(
  type: NotificationType,
  inAppEnabled: boolean,
  emailEnabled: boolean,
): void {
  const policy = defaultPreference(type);
  if (policy.requiredChannels.includes('IN_APP') && !inAppEnabled)
    throw new NotificationError('NOTIFICATION_REQUIRED_CHANNEL');
  if (type === 'SECURITY_SIGN_IN' && !inAppEnabled && !emailEnabled)
    throw new NotificationError('NOTIFICATION_REQUIRED_CHANNEL');
}

export function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function deduplicationKey(input: {
  recipientUserId: string;
  type: NotificationType;
  sourceType: string;
  sourceId: string;
  schemaVersion: number;
  eventVersion?: number;
}): string {
  return sha256({
    recipientUserId: input.recipientUserId,
    type: input.type,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    schemaVersion: input.schemaVersion,
    eventVersion: input.eventVersion ?? 1,
  });
}
