import type { ArenaPrismaClient, Prisma } from '@arena-core/database';
import type { RatingRepository } from '../ports/rating-repository';
import type { RatingTransactionManager } from '../ports/rating-transaction-manager';
import { PrismaRatingRepository } from './prisma-rating-repository';

export class PrismaRatingTransactionManager implements RatingTransactionManager<RatingRepository> {
  public constructor(private readonly client: ArenaPrismaClient) {}

  public transaction<T>(operation: (repository: RatingRepository) => Promise<T>): Promise<T> {
    return this.client.$transaction((tx: Prisma.TransactionClient) =>
      operation(new PrismaRatingRepository(tx)),
    );
  }
}
