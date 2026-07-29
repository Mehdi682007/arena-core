export type NotificationEmailDeliveryResult =
  | Readonly<{ status: 'SENT'; provider: string; providerMessageId?: string }>
  | Readonly<{
      status: 'SKIPPED';
      provider: string;
      errorCode: 'EMAIL_UNVERIFIED' | 'EMAIL_PREFERENCE_DISABLED';
    }>
  | Readonly<{
      status: 'RETRYABLE_FAILURE' | 'PERMANENT_FAILURE';
      provider: string;
      errorCode: string;
    }>;

export interface NotificationEmailDeliveryPort {
  send(input: {
    recipientUserId: string;
    subject: string;
    text: string;
    html?: string;
    deduplicationKey: string;
  }): Promise<NotificationEmailDeliveryResult>;
}
