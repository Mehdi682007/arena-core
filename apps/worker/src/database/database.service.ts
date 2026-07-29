import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { DatabaseConfig, WorkerServiceConfig } from '@arena-core/config';
import {
  checkDatabaseConnection,
  connectPrisma,
  createPrismaClient,
  disconnectPrisma,
  sanitizeDatabaseError,
  type ArenaPrismaClient,
} from '@arena-core/database';
import { WORKER_CONFIG } from '../config/config.module';

export type PrismaClientFactory = typeof createPrismaClient;
export const DATABASE_CLIENT_FACTORY = Symbol('DATABASE_CLIENT_FACTORY');

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly config: DatabaseConfig;
  private client: ArenaPrismaClient | undefined;

  public constructor(
    @Inject(WORKER_CONFIG) workerConfig: WorkerServiceConfig,
    @Inject(DATABASE_CLIENT_FACTORY) private readonly clientFactory: PrismaClientFactory,
  ) {
    this.config = workerConfig.database;
  }

  public async onModuleInit(): Promise<void> {
    if (!this.config.enabled) return;
    try {
      this.client = this.clientFactory(this.config);
      await connectPrisma(this.client);
      await checkDatabaseConnection(this.client);
    } catch (error) {
      throw sanitizeDatabaseError(error);
    }
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.client === undefined) return;
    await disconnectPrisma(this.client);
  }

  public getStatus(): 'disabled' | 'up' {
    return this.config.enabled ? 'up' : 'disabled';
  }
}
