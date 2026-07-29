import {
  retryDelaySeconds,
  validateDeliveryPolicy,
  type NotificationDeliveryPolicy,
} from '../domain/delivery-policies';
import { NotificationError } from '../domain/notification-errors';
import { defaultPreference, normalizeLocale } from '../domain/notification-policies';
import { renderNotificationTemplate } from '../domain/notification-template-registry';
import type { NotificationType } from '../domain/notification-types';
import type { NotificationOutboxRecord } from '../domain/outbox-types';
import type { Clock } from '../ports/clock';
import type { NotificationEmailDeliveryPort } from '../ports/email-delivery-port';
import type { IdGenerator } from '../ports/id-generator';
import type { NotificationRepository } from '../ports/notification-repository';

export class NotificationDeliveryService {
  readonly #policy: NotificationDeliveryPolicy;
  public constructor(
    private readonly repository: NotificationRepository,
    private readonly email: NotificationEmailDeliveryPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    policy: NotificationDeliveryPolicy,
  ) {
    this.#policy = validateDeliveryPolicy(policy);
  }

  public async deliverOutboxMessage(id: string) {
    const message = await this.repository.findOutboxMessage(id);
    if (!message) throw new NotificationError('NOTIFICATION_OUTBOX_NOT_FOUND');
    const now = this.clock.now();
    if (!['PENDING', 'PROCESSING', 'RETRY_SCHEDULED'].includes(message.status))
      throw new NotificationError('NOTIFICATION_OUTBOX_STATE_INVALID');
    if (message.availableAt > now) throw new NotificationError('NOTIFICATION_OUTBOX_STATE_INVALID');
    const attemptNumber = message.attemptCount + 1;
    const startedAt = now;
    if (message.channel === 'IN_APP') {
      await this.attempt(message, {
        status: 'SUCCEEDED',
        provider: 'IN_APP_LOCAL',
        startedAt,
        completedAt: this.clock.now(),
      });
      return this.repository.markDelivered(message.id, message.version, this.clock.now());
    }
    const type = message.notification.type as NotificationType;
    const override = await this.repository.findPreference(
      message.notification.recipientUserId,
      type,
    );
    const preference = override ?? defaultPreference(type);
    if (!preference.emailEnabled) {
      await this.attempt(message, {
        status: 'SKIPPED',
        provider: 'EMAIL_PACKAGE',
        errorCode: 'EMAIL_PREFERENCE_DISABLED',
        errorCategory: 'POLICY',
        startedAt,
        completedAt: this.clock.now(),
      });
      return this.repository.cancelOutbox(
        message.id,
        message.version,
        this.clock.now(),
        'EMAIL_PREFERENCE_DISABLED',
      );
    }
    const rendered = renderNotificationTemplate(
      type,
      normalizeLocale(message.notification.locale),
      message.payloadSnapshot,
    );
    const result = await this.email.send({
      recipientUserId: message.notification.recipientUserId,
      subject: rendered.email?.subject ?? rendered.subject,
      text: rendered.email?.text ?? rendered.body,
      ...(rendered.email?.html ? { html: rendered.email.html } : {}),
      deduplicationKey: message.deduplicationKey,
    });
    if (result.status === 'SENT') {
      await this.attempt(message, {
        status: 'SUCCEEDED',
        provider: result.provider,
        ...(result.providerMessageId ? { providerMessageId: result.providerMessageId } : {}),
        startedAt,
        completedAt: this.clock.now(),
      });
      return this.repository.markDelivered(message.id, message.version, this.clock.now());
    }
    if (result.status === 'SKIPPED') {
      await this.attempt(message, {
        status: 'SKIPPED',
        provider: result.provider,
        errorCode: result.errorCode,
        errorCategory: 'POLICY',
        startedAt,
        completedAt: this.clock.now(),
      });
      return this.repository.cancelOutbox(
        message.id,
        message.version,
        this.clock.now(),
        result.errorCode,
      );
    }
    const retryable =
      result.status === 'RETRYABLE_FAILURE' && attemptNumber < this.#policy.maxAttempts;
    await this.attempt(message, {
      status: retryable ? 'RETRYABLE_FAILURE' : 'PERMANENT_FAILURE',
      provider: result.provider,
      errorCode: result.errorCode,
      errorCategory: retryable ? 'TRANSIENT' : 'PERMANENT',
      startedAt,
      completedAt: this.clock.now(),
    });
    if (!retryable)
      return this.repository.markDeadLettered(
        message.id,
        message.version,
        this.clock.now(),
        result.errorCode,
      );
    const availableAt = new Date(
      this.clock.now().getTime() + retryDelaySeconds(this.#policy, attemptNumber) * 1000,
    );
    return this.repository.scheduleRetry(
      message.id,
      message.version,
      this.clock.now(),
      availableAt,
      result.errorCode,
    );
  }

  private attempt(
    message: NotificationOutboxRecord,
    input: Omit<
      Parameters<NotificationRepository['appendDeliveryAttempt']>[0],
      'id' | 'outboxMessageId' | 'attemptNumber'
    >,
  ) {
    return this.repository.appendDeliveryAttempt({
      id: this.ids.generate(),
      outboxMessageId: message.id,
      attemptNumber: message.attemptCount + 1,
      ...input,
    });
  }
}
