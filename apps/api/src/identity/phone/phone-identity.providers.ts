import type { Provider } from '@nestjs/common';
import type { ApiServiceConfig } from '@arena-core/config';
import {
  IdentityError,
  NodeCryptoTokenService,
  NodePhoneOtpCodeGenerator,
  PhoneOtpService,
  PrismaPhoneIdentityTransactionManager,
  SystemClock,
  type PhoneIdentityRepository,
  type PhoneIdentityTransactionManager,
} from '@arena-core/identity';
import { API_CONFIG } from '../../config/config.module';
import { DatabaseService } from '../../database/database.service';

export const PHONE_OTP_SERVICE = Symbol('PHONE_OTP_SERVICE');

class ApiPhoneIdentityTransactionManager implements PhoneIdentityTransactionManager {
  public constructor(private readonly database: DatabaseService) {}

  public transaction<T>(
    operation: (repository: PhoneIdentityRepository) => Promise<T>,
  ): Promise<T> {
    const client = this.database.getClient();

    if (client === undefined) {
      return Promise.reject(new IdentityError('IDENTITY_DATABASE_DISABLED'));
    }

    return new PrismaPhoneIdentityTransactionManager(client).transaction(operation);
  }
}

export const phoneIdentityProviders: Provider[] = [
  {
    provide: PHONE_OTP_SERVICE,
    inject: [API_CONFIG, DatabaseService],
    useFactory: (config: ApiServiceConfig, database: DatabaseService) =>
      new PhoneOtpService({
        tokenService: new NodeCryptoTokenService(config.authentication),
        codeGenerator: new NodePhoneOtpCodeGenerator(),
        clock: new SystemClock(),
        transactions: new ApiPhoneIdentityTransactionManager(database),
      }),
  },
];
