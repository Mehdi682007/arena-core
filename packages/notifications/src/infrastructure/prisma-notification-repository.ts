import { type ArenaPrismaClient, Prisma } from '@arena-core/database';
import { NotificationError } from '../domain/notification-errors';
import type {
  NotificationPreferenceRecord,
  NotificationRecord,
  NotificationType,
} from '../domain/notification-types';
import type {
  NotificationDeliveryAttemptRecord,
  NotificationOutboxRecord,
} from '../domain/outbox-types';
import type {
  AdminOutboxQuery,
  CreateNotificationPersistenceInput,
  DeliveryAttemptInput,
  NotificationListQuery,
  NotificationRepository,
  PreferenceUpdateInput,
} from '../ports/notification-repository';

type Client = ArenaPrismaClient | Prisma.TransactionClient;
const notificationSelect = {
  id: true,
  recipientUserId: true,
  type: true,
  schemaVersion: true,
  priority: true,
  locale: true,
  subject: true,
  body: true,
  payload: true,
  sourceType: true,
  sourceId: true,
  deduplicationKey: true,
  payloadHash: true,
  createdAt: true,
  readAt: true,
  archivedAt: true,
  expiresAt: true,
  version: true,
} satisfies Prisma.NotificationSelect;
const preferenceSelect = {
  id: true,
  userId: true,
  type: true,
  inAppEnabled: true,
  emailEnabled: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NotificationPreferenceSelect;
const outboxSelect = {
  id: true,
  notificationId: true,
  channel: true,
  status: true,
  deduplicationKey: true,
  availableAt: true,
  attemptCount: true,
  lastAttemptAt: true,
  deliveredAt: true,
  failedAt: true,
  deadLetteredAt: true,
  lastErrorCode: true,
  payloadSnapshot: true,
  claimToken: true,
  claimExpiresAt: true,
  version: true,
  notification: {
    select: {
      recipientUserId: true,
      type: true,
      subject: true,
      body: true,
      locale: true,
    },
  },
} satisfies Prisma.NotificationOutboxMessageSelect;
const attemptSelect = {
  id: true,
  outboxMessageId: true,
  attemptNumber: true,
  status: true,
  provider: true,
  providerMessageId: true,
  errorCode: true,
  errorCategory: true,
  startedAt: true,
  completedAt: true,
} satisfies Prisma.NotificationDeliveryAttemptSelect;
type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;
type PreferenceRow = Prisma.NotificationPreferenceGetPayload<{ select: typeof preferenceSelect }>;
type OutboxRow = Prisma.NotificationOutboxMessageGetPayload<{ select: typeof outboxSelect }>;
type AttemptRow = Prisma.NotificationDeliveryAttemptGetPayload<{ select: typeof attemptSelect }>;

const mapNotification = (row: NotificationRow): NotificationRecord => ({
  ...row,
  schemaVersion: 1,
  locale: row.locale === 'en' ? 'en' : 'fa',
  sourceType: row.sourceType as NotificationRecord['sourceType'],
  payload: row.payload as unknown as NotificationRecord['payload'],
});
const mapPreference = (row: PreferenceRow): NotificationPreferenceRecord => ({
  ...row,
  type: row.type as NotificationType,
});
const mapOutbox = (row: OutboxRow): NotificationOutboxRecord => ({
  ...row,
  payloadSnapshot: row.payloadSnapshot as unknown as NotificationOutboxRecord['payloadSnapshot'],
});
const mapAttempt = (row: AttemptRow): NotificationDeliveryAttemptRecord => row;
function persistence(error: unknown): never {
  if (error instanceof NotificationError) throw error;
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String((error as { code?: unknown }).code) === 'P2002'
  )
    throw new NotificationError('NOTIFICATION_DEDUPLICATION_CONFLICT');
  throw new NotificationError('NOTIFICATION_PERSISTENCE_FAILURE');
}

export class PrismaNotificationRepository implements NotificationRepository {
  public constructor(private readonly client: Client) {}

  public async recipientExists(userId: string) {
    return (
      (await this.client.user.findFirst({
        where: { id: userId, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      })) !== null
    );
  }
  public async findByDeduplicationKey(key: string) {
    const row = await this.client.notification.findUnique({
      where: { deduplicationKey: key },
      select: notificationSelect,
    });
    return row ? mapNotification(row) : null;
  }
  public async createNotificationWithOutbox(input: CreateNotificationPersistenceInput) {
    try {
      return mapNotification(
        await this.client.notification.create({
          data: {
            id: input.notification.id,
            recipientUserId: input.notification.recipientUserId,
            type: input.notification.type,
            schemaVersion: input.notification.schemaVersion,
            priority: input.notification.priority,
            locale: input.notification.locale,
            subject: input.notification.subject,
            body: input.notification.body,
            payload: input.notification.payload as unknown as Prisma.InputJsonValue,
            sourceType: input.notification.sourceType,
            sourceId: input.notification.sourceId,
            deduplicationKey: input.notification.deduplicationKey,
            payloadHash: input.notification.payloadHash,
            createdAt: input.notification.createdAt,
            ...(input.notification.expiresAt ? { expiresAt: input.notification.expiresAt } : {}),
            outboxMessages: {
              create: input.channels.map((channel) => ({
                id: input.outboxIds[channel],
                channel,
                status: 'PENDING',
                deduplicationKey: `${input.notification.deduplicationKey}:${channel}`,
                availableAt: input.availableAt,
                payloadSnapshot: input.notification.payload as unknown as Prisma.InputJsonValue,
              })),
            },
          },
          select: notificationSelect,
        }),
      );
    } catch (error) {
      return persistence(error);
    }
  }
  public async listNotificationsForUser(userId: string, query: NotificationListQuery) {
    const rows = await this.client.notification.findMany({
      where: {
        recipientUserId: userId,
        ...(query.archived === undefined
          ? { archivedAt: null }
          : query.archived
            ? { archivedAt: { not: null } }
            : { archivedAt: null }),
        ...(query.unread === undefined ? {} : { readAt: query.unread ? null : { not: null } }),
        ...(query.type ? { type: query.type } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: query.now } }],
      },
      select: notificationSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
    });
    return {
      items: rows.slice(0, query.limit).map(mapNotification),
      nextCursor: rows.length > query.limit ? (rows[query.limit - 1]?.id ?? null) : null,
    };
  }
  public countUnreadForUser(userId: string, now: Date) {
    return this.client.notification.count({
      where: {
        recipientUserId: userId,
        readAt: null,
        archivedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
  }
  public async findNotificationForUser(userId: string, notificationId: string) {
    const row = await this.client.notification.findFirst({
      where: { id: notificationId, recipientUserId: userId },
      select: notificationSelect,
    });
    return row ? mapNotification(row) : null;
  }
  public async setReadState(userId: string, notificationId: string, readAt: Date | null) {
    const updated = await this.client.notification.updateMany({
      where: { id: notificationId, recipientUserId: userId },
      data: { readAt, version: { increment: 1 } },
    });
    if (!updated.count) throw new NotificationError('NOTIFICATION_NOT_FOUND');
    const row = await this.client.notification.findUniqueOrThrow({
      where: { id: notificationId },
      select: notificationSelect,
    });
    return mapNotification(row);
  }
  public async archive(userId: string, notificationId: string, now: Date) {
    const updated = await this.client.notification.updateMany({
      where: { id: notificationId, recipientUserId: userId },
      data: { archivedAt: now, version: { increment: 1 } },
    });
    if (!updated.count) throw new NotificationError('NOTIFICATION_NOT_FOUND');
    return mapNotification(
      await this.client.notification.findUniqueOrThrow({
        where: { id: notificationId },
        select: notificationSelect,
      }),
    );
  }
  public async findPreference(userId: string, type: NotificationType) {
    const row = await this.client.notificationPreference.findUnique({
      where: { userId_type: { userId, type } },
      select: preferenceSelect,
    });
    return row ? mapPreference(row) : null;
  }
  public async updatePreference(input: PreferenceUpdateInput) {
    try {
      const existing = await this.client.notificationPreference.findUnique({
        where: { userId_type: { userId: input.userId, type: input.type } },
        select: { version: true },
      });
      if (
        existing &&
        input.expectedVersion !== undefined &&
        existing.version !== input.expectedVersion
      )
        throw new NotificationError('NOTIFICATION_PREFERENCE_INVALID');
      return mapPreference(
        await this.client.notificationPreference.upsert({
          where: { userId_type: { userId: input.userId, type: input.type } },
          create: {
            id: input.id,
            userId: input.userId,
            type: input.type,
            inAppEnabled: input.inAppEnabled,
            emailEnabled: input.emailEnabled,
            createdAt: input.now,
            updatedAt: input.now,
          },
          update: {
            inAppEnabled: input.inAppEnabled,
            emailEnabled: input.emailEnabled,
            version: { increment: 1 },
          },
          select: preferenceSelect,
        }),
      );
    } catch (error) {
      return persistence(error);
    }
  }
  public async listPreferencesForUser(userId: string) {
    return (
      await this.client.notificationPreference.findMany({
        where: { userId },
        select: preferenceSelect,
        orderBy: { type: 'asc' },
      })
    ).map(mapPreference);
  }
  public async findOutboxMessage(id: string) {
    const row = await this.client.notificationOutboxMessage.findUnique({
      where: { id },
      select: outboxSelect,
    });
    return row ? mapOutbox(row) : null;
  }
  public async claimPendingMessages(
    now: Date,
    limit: number,
    leaseSeconds: number,
    claimToken: string,
  ) {
    const rows = await this.client.notificationOutboxMessage.findMany({
      where: {
        status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
        availableAt: { lte: now },
      },
      select: { id: true, version: true },
      orderBy: [{ availableAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    const claimed: NotificationOutboxRecord[] = [];
    for (const row of rows) {
      const updated = await this.client.notificationOutboxMessage.updateMany({
        where: {
          id: row.id,
          version: row.version,
          status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
        },
        data: {
          status: 'PROCESSING',
          claimToken,
          claimExpiresAt: new Date(now.getTime() + leaseSeconds * 1000),
          version: { increment: 1 },
        },
      });
      if (updated.count) {
        const item = await this.findOutboxMessage(row.id);
        if (item) claimed.push(item);
      }
    }
    return claimed;
  }
  public async releaseExpiredClaims(now: Date, limit: number) {
    const rows = await this.client.notificationOutboxMessage.findMany({
      where: { status: 'PROCESSING', claimExpiresAt: { lte: now } },
      select: { id: true, version: true },
      orderBy: [{ claimExpiresAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    let count = 0;
    for (const row of rows)
      count += (
        await this.client.notificationOutboxMessage.updateMany({
          where: { id: row.id, version: row.version, status: 'PROCESSING' },
          data: {
            status: 'RETRY_SCHEDULED',
            availableAt: now,
            claimToken: null,
            claimExpiresAt: null,
            version: { increment: 1 },
          },
        })
      ).count;
    return count;
  }
  public async appendDeliveryAttempt(input: DeliveryAttemptInput) {
    try {
      return mapAttempt(
        await this.client.notificationDeliveryAttempt.create({
          data: input,
          select: attemptSelect,
        }),
      );
    } catch (error) {
      return persistence(error);
    }
  }
  private async transition(
    id: string,
    expectedVersion: number,
    data: Prisma.NotificationOutboxMessageUpdateManyMutationInput,
  ) {
    const updated = await this.client.notificationOutboxMessage.updateMany({
      where: {
        id,
        version: expectedVersion,
        status: { in: ['PENDING', 'PROCESSING', 'RETRY_SCHEDULED'] },
      },
      data: {
        ...data,
        claimToken: null,
        claimExpiresAt: null,
        attemptCount: { increment: 1 },
        version: { increment: 1 },
      },
    });
    if (!updated.count) throw new NotificationError('NOTIFICATION_OUTBOX_STATE_INVALID');
    const item = await this.findOutboxMessage(id);
    if (!item) throw new NotificationError('NOTIFICATION_OUTBOX_NOT_FOUND');
    return item;
  }
  public markDelivered(id: string, version: number, now: Date) {
    return this.transition(id, version, {
      status: 'DELIVERED',
      deliveredAt: now,
      lastAttemptAt: now,
      lastErrorCode: null,
    });
  }
  public scheduleRetry(
    id: string,
    version: number,
    now: Date,
    availableAt: Date,
    errorCode: string,
  ) {
    return this.transition(id, version, {
      status: 'RETRY_SCHEDULED',
      availableAt,
      lastAttemptAt: now,
      failedAt: now,
      lastErrorCode: errorCode,
    });
  }
  public markDeadLettered(id: string, version: number, now: Date, errorCode: string) {
    return this.transition(id, version, {
      status: 'DEAD_LETTERED',
      deadLetteredAt: now,
      lastAttemptAt: now,
      failedAt: now,
      lastErrorCode: errorCode,
    });
  }
  public cancelOutbox(id: string, version: number, now: Date, reasonCode: string) {
    return this.transition(id, version, {
      status: 'CANCELLED',
      failedAt: now,
      lastAttemptAt: now,
      lastErrorCode: reasonCode,
    });
  }
  public async listOutboxForAdmin(query: AdminOutboxQuery) {
    const rows = await this.client.notificationOutboxMessage.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.channel ? { channel: query.channel } : {}),
        ...(query.type ? { notification: { type: query.type } } : {}),
        ...(query.attemptMin === undefined ? {} : { attemptCount: { gte: query.attemptMin } }),
        ...(!query.createdFrom && !query.createdTo
          ? {}
          : {
              createdAt: {
                ...(query.createdFrom ? { gte: query.createdFrom } : {}),
                ...(query.createdTo ? { lte: query.createdTo } : {}),
              },
            }),
      },
      select: outboxSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
    });
    return {
      items: rows.slice(0, query.limit).map(mapOutbox),
      nextCursor: rows.length > query.limit ? (rows[query.limit - 1]?.id ?? null) : null,
    };
  }
  public async retryOutboxMessage(id: string, now: Date) {
    const updated = await this.client.notificationOutboxMessage.updateMany({
      where: { id, status: { in: ['DEAD_LETTERED', 'FAILED', 'CANCELLED'] } },
      data: {
        status: 'RETRY_SCHEDULED',
        availableAt: now,
        deadLetteredAt: null,
        failedAt: null,
        lastErrorCode: null,
        claimToken: null,
        claimExpiresAt: null,
        version: { increment: 1 },
      },
    });
    if (!updated.count) throw new NotificationError('NOTIFICATION_OUTBOX_STATE_INVALID');
    const item = await this.findOutboxMessage(id);
    if (!item) throw new NotificationError('NOTIFICATION_OUTBOX_NOT_FOUND');
    return item;
  }
}
