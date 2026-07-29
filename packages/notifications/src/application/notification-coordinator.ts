import type {
  CreateNotificationInput,
  NotificationPayloadEnvelope,
  NotificationSourceType,
  NotificationType,
} from '../domain/notification-types';
import type { NotificationService } from './notification-service';

export interface NotificationIntegrationFailure {
  readonly type: NotificationType;
  readonly sourceType: NotificationSourceType;
  readonly sourceId: string;
  readonly recipientUserId: string;
  readonly errorCode: 'NOTIFICATION_CREATION_FAILED';
}
export interface NotificationIntegrationFailureSink {
  record(failure: NotificationIntegrationFailure): void | Promise<void>;
}

export class NotificationCoordinator {
  public constructor(
    private readonly notifications: NotificationService,
    private readonly failures?: NotificationIntegrationFailureSink,
  ) {}

  public notify(input: Omit<CreateNotificationInput, 'schemaVersion'>) {
    return this.notifications.create({ ...input, schemaVersion: 1 });
  }

  public recoverSource(input: {
    recipients: readonly string[];
    type: NotificationType;
    sourceType: NotificationSourceType;
    sourceId: string;
    eventVersion: number;
    payload: NotificationPayloadEnvelope;
    locale?: string;
  }) {
    return this.notifyRecipients(input);
  }

  public proposalCreated(input: {
    recipients: readonly string[];
    proposalId: string;
    eventVersion: number;
    game: string;
    mode: string;
    expiration: string;
    state: string;
    locale?: string;
  }) {
    return this.notifyRecipients({
      recipients: input.recipients,
      type: 'MATCHMAKING_PROPOSAL_CREATED',
      sourceType: 'MATCHMAKING_PROPOSAL',
      sourceId: input.proposalId,
      eventVersion: input.eventVersion,
      ...(input.locale ? { locale: input.locale } : {}),
      payload: {
        schemaVersion: 1,
        data: {
          game: input.game,
          mode: input.mode,
          expiration: input.expiration,
          status: input.state,
        },
      },
    });
  }

  public matchReady(input: {
    recipients: readonly string[];
    matchId: string;
    eventVersion: number;
    game: string;
    mode: string;
    readyDeadlineAt: string;
    locale?: string;
  }) {
    return this.notifyRecipients({
      recipients: input.recipients,
      type: 'MATCH_READY_REQUIRED',
      sourceType: 'MATCH',
      sourceId: input.matchId,
      eventVersion: input.eventVersion,
      ...(input.locale ? { locale: input.locale } : {}),
      payload: {
        schemaVersion: 1,
        data: {
          matchId: input.matchId,
          game: input.game,
          mode: input.mode,
          readyDeadlineAt: input.readyDeadlineAt,
          status: 'AWAITING_READY',
        },
      },
    });
  }

  public result(input: {
    recipients: readonly string[];
    matchId: string;
    resultId: string;
    eventVersion: number;
    status: 'CONFIRMED' | 'CONFLICT';
    summary: string;
    nextAction?: string;
  }) {
    return this.notifyRecipients({
      recipients: input.recipients,
      type: input.status === 'CONFIRMED' ? 'MATCH_RESULT_CONFIRMED' : 'MATCH_RESULT_CONFLICT',
      sourceType: 'MATCH_RESULT',
      sourceId: input.resultId,
      eventVersion: input.eventVersion,
      payload: {
        schemaVersion: 1,
        data: {
          matchId: input.matchId,
          status: input.status,
          summary: input.summary,
          ...(input.nextAction ? { nextAction: input.nextAction } : {}),
        },
      },
    });
  }

  public disputeOpened(input: {
    recipientUserId: string;
    disputeId: string;
    matchId: string;
    eventVersion: number;
    status: string;
    responseDeadline: string;
    reasonCategory?: string;
  }) {
    return this.notifyRecipients({
      recipients: [input.recipientUserId],
      type: 'MATCH_DISPUTE_OPENED',
      sourceType: 'MATCH_DISPUTE',
      sourceId: input.disputeId,
      eventVersion: input.eventVersion,
      payload: {
        schemaVersion: 1,
        data: {
          matchId: input.matchId,
          status: input.status,
          responseDeadline: input.responseDeadline,
          ...(input.reasonCategory ? { reasonCategory: input.reasonCategory } : {}),
        },
      },
    });
  }

  public disputeResolved(input: {
    recipients: readonly string[];
    disputeId: string;
    matchId: string;
    eventVersion: number;
    resolution: string;
    resolvedAt: string;
    resultSummary?: string;
  }) {
    return this.notifyRecipients({
      recipients: input.recipients,
      type: 'MATCH_DISPUTE_RESOLVED',
      sourceType: 'MATCH_DISPUTE',
      sourceId: input.disputeId,
      eventVersion: input.eventVersion,
      payload: {
        schemaVersion: 1,
        data: {
          matchId: input.matchId,
          resolution: input.resolution,
          resolvedAt: input.resolvedAt,
          ...(input.resultSummary ? { resultSummary: input.resultSummary } : {}),
        },
      },
    });
  }

  public settlementCompleted(input: {
    settlementId: string;
    matchId: string;
    eventVersion: number;
    recipients: readonly { userId: string; ownAmount: string }[];
    settlementType: string;
  }) {
    return Promise.allSettled(
      input.recipients.map((recipient) =>
        this.safeNotify({
          recipientUserId: recipient.userId,
          type: 'MATCH_SETTLEMENT_COMPLETED',
          sourceType: 'MATCH_SETTLEMENT',
          sourceId: input.settlementId,
          eventVersion: input.eventVersion,
          payload: {
            schemaVersion: 1,
            data: {
              matchId: input.matchId,
              settlementType: input.settlementType,
              amount: recipient.ownAmount,
              nonMonetary: true,
            },
          },
        }),
      ),
    );
  }

  public ratingUpdated(input: {
    applicationId: string;
    eventVersion: number;
    game: string;
    mode: string;
    recipients: readonly {
      userId: string;
      ratingBefore: number;
      ratingAfter: number;
      ratingDelta: number;
      outcome: string;
    }[];
  }) {
    return Promise.allSettled(
      input.recipients.map((recipient) =>
        this.safeNotify({
          recipientUserId: recipient.userId,
          type: 'RATING_UPDATED',
          sourceType: 'RATING_APPLICATION',
          sourceId: input.applicationId,
          eventVersion: input.eventVersion,
          payload: {
            schemaVersion: 1,
            data: {
              game: input.game,
              mode: input.mode,
              ratingBefore: recipient.ratingBefore,
              ratingAfter: recipient.ratingAfter,
              delta: recipient.ratingDelta,
              outcome: recipient.outcome,
            },
          },
        }),
      ),
    );
  }

  private notifyRecipients(input: {
    recipients: readonly string[];
    type: NotificationType;
    sourceType: NotificationSourceType;
    sourceId: string;
    eventVersion: number;
    payload: NotificationPayloadEnvelope;
    locale?: string;
  }) {
    return Promise.allSettled(
      input.recipients.map((recipientUserId) =>
        this.safeNotify({
          recipientUserId,
          type: input.type,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          eventVersion: input.eventVersion,
          payload: input.payload,
          ...(input.locale ? { locale: input.locale } : {}),
        }),
      ),
    );
  }

  private async safeNotify(input: Omit<CreateNotificationInput, 'schemaVersion'>) {
    try {
      return await this.notify(input);
    } catch {
      await this.failures?.record({
        type: input.type,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        recipientUserId: input.recipientUserId,
        errorCode: 'NOTIFICATION_CREATION_FAILED',
      });
      throw new Error('NOTIFICATION_CREATION_FAILED');
    }
  }
}
