import { NotificationError } from './notification-errors';

export interface NotificationDeliveryPolicy {
  readonly maxAttempts: number;
  readonly retryBaseSeconds: number;
  readonly retryMaxSeconds: number;
  readonly claimLeaseSeconds: number;
}

export function validateDeliveryPolicy(
  policy: NotificationDeliveryPolicy,
): NotificationDeliveryPolicy {
  if (
    !Number.isSafeInteger(policy.maxAttempts) ||
    policy.maxAttempts < 1 ||
    policy.maxAttempts > 20 ||
    !Number.isSafeInteger(policy.retryBaseSeconds) ||
    policy.retryBaseSeconds < 1 ||
    policy.retryBaseSeconds > 86_400 ||
    !Number.isSafeInteger(policy.retryMaxSeconds) ||
    policy.retryMaxSeconds < policy.retryBaseSeconds ||
    policy.retryMaxSeconds > 604_800 ||
    !Number.isSafeInteger(policy.claimLeaseSeconds) ||
    policy.claimLeaseSeconds < 5 ||
    policy.claimLeaseSeconds > 3600
  )
    throw new NotificationError('NOTIFICATION_OUTBOX_STATE_INVALID');
  return Object.freeze({ ...policy });
}

export function retryDelaySeconds(
  policyInput: NotificationDeliveryPolicy,
  attemptCount: number,
): number {
  const policy = validateDeliveryPolicy(policyInput);
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 1)
    throw new NotificationError('NOTIFICATION_OUTBOX_STATE_INVALID');
  return Math.min(policy.retryMaxSeconds, policy.retryBaseSeconds * 2 ** (attemptCount - 1));
}
