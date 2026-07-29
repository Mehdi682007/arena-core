import type { ArenaPrismaClient, Prisma } from '@arena-core/database';
import {
  createEmailMessage,
  EmailError,
  type EmailAddress,
  type EmailSender,
} from '@arena-core/email';
import type {
  NotificationEmailDeliveryPort,
  NotificationEmailDeliveryResult,
} from '../ports/email-delivery-port';

type Client = ArenaPrismaClient | Prisma.TransactionClient;

export class EmailPackageNotificationAdapter implements NotificationEmailDeliveryPort {
  public constructor(
    private readonly client: Client,
    private readonly sender: EmailSender,
    private readonly from: EmailAddress,
    private readonly replyTo?: EmailAddress,
  ) {}

  public async send(input: {
    recipientUserId: string;
    subject: string;
    text: string;
    html?: string;
    deduplicationKey: string;
  }): Promise<NotificationEmailDeliveryResult> {
    const recipient = await this.client.userEmail.findFirst({
      where: {
        userId: input.recipientUserId,
        isPrimary: true,
        verifiedAt: { not: null },
        user: { status: 'ACTIVE', deletedAt: null },
      },
      select: { email: true },
    });
    if (!recipient)
      return {
        status: 'SKIPPED',
        provider: 'EMAIL_PACKAGE',
        errorCode: 'EMAIL_UNVERIFIED',
      };
    try {
      const result = await this.sender.send(
        createEmailMessage({
          to: { address: recipient.email },
          from: this.from,
          ...(this.replyTo ? { replyTo: this.replyTo } : {}),
          subject: input.subject,
          text: input.text,
          html: input.html ?? `<p>${input.text}</p>`,
          headers: { 'X-Arena-Idempotency-Key': input.deduplicationKey },
          tags: ['notification'],
        }),
      );
      return {
        status: 'SENT',
        provider: 'EMAIL_PACKAGE',
        ...(result.messageId ? { providerMessageId: result.messageId } : {}),
      };
    } catch (error) {
      return {
        status:
          error instanceof EmailError && error.code === 'EMAIL_DELIVERY_REJECTED'
            ? 'PERMANENT_FAILURE'
            : 'RETRYABLE_FAILURE',
        provider: 'EMAIL_PACKAGE',
        errorCode: error instanceof EmailError ? error.code : 'EMAIL_DELIVERY_UNAVAILABLE',
      };
    }
  }
}
