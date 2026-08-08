import type { Provider } from '@nestjs/common';
import type { ApiServiceConfig } from '@arena-core/config';
import {
  IdentityError,
  MfaService,
  NodeCryptoTokenService,
  NodeMfaCrypto,
  PrismaMfaTransactionManager,
  SystemClock,
  type MfaRepository,
  type MfaTransactionManager,
} from '@arena-core/identity';
import { API_CONFIG } from '../../config/config.module';
import { DatabaseService } from '../../database/database.service';

export const MFA_SERVICE = Symbol('MFA_SERVICE');

class ApiMfaTransactionManager implements MfaTransactionManager {
  public constructor(private readonly database: DatabaseService) {}

  public transaction<T>(operation: (repository: MfaRepository) => Promise<T>): Promise<T> {
    const client = this.database.getClient();

    if (client === undefined) {
      return Promise.reject(new IdentityError('IDENTITY_DATABASE_DISABLED'));
    }

    return new PrismaMfaTransactionManager(client).transaction(operation);
  }
}

export const mfaProviders: Provider[] = [
  {
    provide: MFA_SERVICE,
    inject: [API_CONFIG, DatabaseService],
    useFactory: (config: ApiServiceConfig, database: DatabaseService) =>
      new MfaService({
        crypto: new NodeMfaCrypto(config.authentication.tokenHashKey.reveal()),
        tokenService: new NodeCryptoTokenService(config.authentication),
        clock: new SystemClock(),
        transactions: new ApiMfaTransactionManager(database),
      }),
  },
];
