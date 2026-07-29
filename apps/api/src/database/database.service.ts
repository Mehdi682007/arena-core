import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { ApiServiceConfig, DatabaseConfig } from '@arena-core/config';
import {
  checkDatabaseConnection,
  connectPrisma,
  createPrismaClient,
  disconnectPrisma,
  sanitizeDatabaseError,
  type ArenaPrismaClient,
} from '@arena-core/database';
import { API_CONFIG } from '../config/config.module';

export type DatabaseDependencyStatus = 'disabled' | 'up' | 'down';
export type PrismaClientFactory = typeof createPrismaClient;
export const DATABASE_CLIENT_FACTORY = Symbol('DATABASE_CLIENT_FACTORY');

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private client: ArenaPrismaClient | undefined;

  public constructor(
    @Inject(API_CONFIG) apiConfig: ApiServiceConfig,
    @Inject(DATABASE_CLIENT_FACTORY) private readonly clientFactory: PrismaClientFactory,
  ) {
    this.config = apiConfig.database;
  }

  private readonly config: DatabaseConfig;

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

  public async getStatus(): Promise<DatabaseDependencyStatus> {
    if (!this.config.enabled) return 'disabled';
    if (this.client === undefined) return 'down';
    try {
      await checkDatabaseConnection(this.client);
      return 'up';
    } catch {
      return 'down';
    }
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.client === undefined) return;
    await disconnectPrisma(this.client);
  }

  public getClient(): ArenaPrismaClient | undefined {
    return this.client;
  }
}
