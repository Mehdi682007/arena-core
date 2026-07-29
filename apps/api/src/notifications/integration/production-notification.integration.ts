import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationCoordinator } from '@arena-core/notifications';
import { DatabaseService } from '../../database/database.service';
import { NOTIFICATION_SERVICE } from '../notifications.providers';
import type { NotificationService } from '@arena-core/notifications';

export interface ProductionNotificationIntegrationPort {
  proposalCreated(id: string): Promise<void>;
  matchReady(id: string): Promise<void>;
  resultFinalized(matchId: string): Promise<void>;
  disputeOpened(id: string): Promise<void>;
  disputeResolved(id: string): Promise<void>;
  settlementCompleted(id: string): Promise<void>;
  ratingUpdated(id: string): Promise<void>;
  recoverMissingNotificationsForSource(sourceType: string, sourceId: string): Promise<boolean>;
}

@Injectable()
export class ProductionNotificationIntegration implements ProductionNotificationIntegrationPort {
  private readonly coordinator: NotificationCoordinator;
  private readonly logger = new Logger(ProductionNotificationIntegration.name);
  public constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(NOTIFICATION_SERVICE) notifications: NotificationService,
  ) {
    this.coordinator = new NotificationCoordinator(notifications, {
      record: () => undefined,
    });
  }

  public async proposalCreated(id: string): Promise<void> {
    await this.isolated('MATCHMAKING_PROPOSAL', id, async () => {
      const client = this.client();
      const item = await client.matchmakingProposal.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          version: true,
          expiresAt: true,
          requestA: { select: { userId: true } },
          requestB: { select: { userId: true } },
          game: { select: { key: true } },
          gameMode: { select: { key: true } },
        },
      });
      if (!item) return;
      await this.coordinator.proposalCreated({
        recipients: [item.requestA.userId, item.requestB.userId],
        proposalId: item.id,
        eventVersion: item.version,
        game: item.game.key,
        mode: item.gameMode.key,
        expiration: item.expiresAt.toISOString(),
        state: item.status,
      });
    });
  }

  public async matchReady(id: string): Promise<void> {
    await this.isolated('MATCH', id, async () => {
      const item = await this.client().match.findUnique({
        where: { id },
        select: {
          id: true,
          version: true,
          readyDeadlineAt: true,
          participants: { select: { userId: true } },
          game: { select: { key: true } },
          gameMode: { select: { key: true } },
        },
      });
      if (!item) return;
      await this.coordinator.matchReady({
        recipients: item.participants.map((p) => p.userId),
        matchId: item.id,
        eventVersion: item.version,
        game: item.game.key,
        mode: item.gameMode.key,
        readyDeadlineAt: item.readyDeadlineAt.toISOString(),
      });
    });
  }

  public async resultFinalized(matchId: string): Promise<void> {
    await this.isolated('MATCH_RESULT', matchId, async () => {
      const item = await this.client().matchResult.findUnique({
        where: { matchId },
        select: {
          id: true,
          matchId: true,
          status: true,
          version: true,
          isDraw: true,
          match: { select: { participants: { select: { userId: true } } } },
        },
      });
      if (!item || !['CONFIRMED', 'CONFLICT', 'ADMIN_RESOLVED'].includes(item.status)) return;
      await this.coordinator.result({
        recipients: item.match.participants.map((p) => p.userId),
        matchId: item.matchId,
        resultId: item.id,
        eventVersion: item.version,
        status: item.status === 'CONFLICT' ? 'CONFLICT' : 'CONFIRMED',
        summary: item.status === 'CONFLICT' ? 'RESULT_CONFLICT' : item.isDraw ? 'DRAW' : 'FINAL',
        ...(item.status === 'CONFLICT' ? { nextAction: 'REVIEW_RESULT' } : {}),
      });
    });
  }

  public async disputeOpened(id: string): Promise<void> {
    await this.isolated('MATCH_DISPUTE', id, async () => {
      const item = await this.client().matchDispute.findUnique({
        where: { id },
        select: {
          id: true,
          matchId: true,
          version: true,
          status: true,
          openedByUserId: true,
          reasonCode: true,
          responseDeadlineAt: true,
          match: { select: { participants: { select: { userId: true } } } },
        },
      });
      if (!item) return;
      const opponent = item.match.participants.find((p) => p.userId !== item.openedByUserId);
      if (!opponent) return;
      await this.coordinator.disputeOpened({
        recipientUserId: opponent.userId,
        disputeId: item.id,
        matchId: item.matchId,
        eventVersion: item.version,
        status: item.status,
        responseDeadline: item.responseDeadlineAt.toISOString(),
        reasonCategory: item.reasonCode,
      });
    });
  }

  public async disputeResolved(id: string): Promise<void> {
    await this.isolated('MATCH_DISPUTE', id, async () => {
      const item = await this.client().matchDispute.findUnique({
        where: { id },
        select: {
          id: true,
          matchId: true,
          version: true,
          resolutionType: true,
          resolvedAt: true,
          match: { select: { participants: { select: { userId: true } } } },
        },
      });
      if (!item?.resolvedAt || !item.resolutionType) return;
      await this.coordinator.disputeResolved({
        recipients: item.match.participants.map((p) => p.userId),
        disputeId: item.id,
        matchId: item.matchId,
        eventVersion: item.version,
        resolution: item.resolutionType,
        resolvedAt: item.resolvedAt.toISOString(),
      });
    });
  }

  public async settlementCompleted(id: string): Promise<void> {
    await this.isolated('MATCH_SETTLEMENT', id, async () => {
      const item = await this.client().matchSettlement.findUnique({
        where: { id },
        select: {
          id: true,
          matchId: true,
          version: true,
          type: true,
          winnerParticipantId: true,
          distributedAmount: true,
          reservations: { select: { userId: true, participantId: true, amount: true } },
        },
      });
      if (!item) return;
      await this.coordinator.settlementCompleted({
        settlementId: item.id,
        matchId: item.matchId,
        eventVersion: item.version,
        settlementType: item.type,
        recipients: item.reservations.map((r) => ({
          userId: r.userId,
          ownAmount:
            item.type === 'WINNER_TAKES_ALL'
              ? (r.participantId === item.winnerParticipantId
                  ? item.distributedAmount
                  : 0n
                ).toString()
              : r.amount.toString(),
        })),
      });
    });
  }

  public async ratingUpdated(id: string): Promise<void> {
    await this.isolated('RATING_APPLICATION', id, async () => {
      const item = await this.client().matchRatingApplication.findUnique({
        where: { id },
        select: {
          id: true,
          version: true,
          match: {
            select: { game: { select: { key: true } }, gameMode: { select: { key: true } } },
          },
          changes: {
            select: {
              userId: true,
              ratingBefore: true,
              ratingAfter: true,
              ratingDelta: true,
              outcome: true,
            },
          },
        },
      });
      if (!item) return;
      await this.coordinator.ratingUpdated({
        applicationId: item.id,
        eventVersion: item.version,
        game: item.match.game.key,
        mode: item.match.gameMode.key,
        recipients: item.changes,
      });
    });
  }

  public async recoverMissingNotificationsForSource(sourceType: string, sourceId: string) {
    const handlers: Record<string, (id: string) => Promise<void>> = {
      MATCHMAKING_PROPOSAL: (id) => this.proposalCreated(id),
      MATCH: (id) => this.matchReady(id),
      MATCH_RESULT: (id) => this.resultFinalized(id),
      MATCH_DISPUTE: (id) => this.recoverDispute(id),
      MATCH_SETTLEMENT: (id) => this.settlementCompleted(id),
      RATING_APPLICATION: (id) => this.ratingUpdated(id),
    };
    const handler = handlers[sourceType];
    if (!handler) return false;
    await handler(sourceId);
    return true;
  }

  private client() {
    const client = this.database.getClient();
    if (!client) throw new Error('NOTIFICATION_SERVICE_UNAVAILABLE');
    return client;
  }
  private async recoverDispute(id: string) {
    const item = await this.client().matchDispute.findUnique({
      where: { id },
      select: { resolvedAt: true },
    });
    if (!item) return;
    await (item.resolvedAt ? this.disputeResolved(id) : this.disputeOpened(id));
  }
  private async isolated(sourceType: string, sourceId: string, operation: () => Promise<void>) {
    try {
      await operation();
    } catch {
      this.logger.warn({ event: 'notification_creation_failed', sourceType, sourceId });
    }
  }
}
