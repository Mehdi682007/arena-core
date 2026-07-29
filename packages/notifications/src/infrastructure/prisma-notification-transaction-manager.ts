import type { ArenaPrismaClient, Prisma } from '@arena-core/database';
import type { NotificationRepository } from '../ports/notification-repository';
import type { NotificationTransactionManager } from '../ports/notification-transaction-manager';
import { PrismaNotificationRepository } from './prisma-notification-repository';

export class PrismaNotificationTransactionManager implements NotificationTransactionManager<NotificationRepository> {
  public constructor(private readonly client: ArenaPrismaClient) {}
  public transaction<T>(operation: (repository: NotificationRepository) => Promise<T>): Promise<T> {
    return this.client.$transaction((tx: Prisma.TransactionClient) =>
      operation(new PrismaNotificationRepository(tx)),
    );
  }
}
