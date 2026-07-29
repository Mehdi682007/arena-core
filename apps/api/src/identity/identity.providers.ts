import type { Provider } from '@nestjs/common';
import {
  createIdentityServices,
  IdentityError,
  PrismaIdentityTransactionManager,
  type IdentityRepository,
  type IdentityTransactionManager,
} from '@arena-core/identity';
import type { ApiServiceConfig } from '@arena-core/config';
import { API_CONFIG } from '../config/config.module';
import { DatabaseService } from '../database/database.service';

export const IDENTITY_SERVICES = Symbol('IDENTITY_SERVICES');
export type IdentityServiceCollection = Awaited<ReturnType<typeof createIdentityServices>>;

class ApiIdentityTransactionManager implements IdentityTransactionManager {
  public constructor(private readonly database: DatabaseService) {}

  public async transaction<T>(
    operation: (repository: IdentityRepository) => Promise<T>,
  ): Promise<T> {
    const client = this.database.getClient();
    if (client === undefined) throw new IdentityError('IDENTITY_DATABASE_DISABLED');
    return new PrismaIdentityTransactionManager(client).transaction(operation);
  }
}

export const identityProviders: Provider[] = [
  {
    provide: IDENTITY_SERVICES,
    inject: [API_CONFIG, DatabaseService],
    useFactory: async (config: ApiServiceConfig, database: DatabaseService) => {
      return createIdentityServices(
        config.authentication,
        new ApiIdentityTransactionManager(database),
      );
    },
  },
];
