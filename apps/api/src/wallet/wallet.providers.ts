import { Inject, Injectable, type Provider } from '@nestjs/common';
import {
  AdminWalletService,
  PrismaWalletRepository,
  SystemClock,
  WalletError,
  WalletLedgerService,
  WalletQueryService,
  WalletReconciliationService,
  type WalletRepository,
} from '@arena-core/wallet';
import { DatabaseAuthorizationService } from '../authorization/database-authorization.service';
import { DatabaseService } from '../database/database.service';

export const WALLET_QUERY_SERVICE = Symbol('WALLET_QUERY_SERVICE');
export const ADMIN_WALLET_SERVICE = Symbol('ADMIN_WALLET_SERVICE');
export const WALLET_RECONCILIATION_SERVICE = Symbol('WALLET_RECONCILIATION_SERVICE');
export const WALLET_AUTHORIZATION = Symbol('WALLET_AUTHORIZATION');
export interface WalletAuthorization {
  hasPermission(userId: string, permission: string): Promise<boolean>;
}
@Injectable()
class ApiWalletRepository {
  public constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  public get(): WalletRepository {
    const client = this.database.getClient();
    if (!client) throw new WalletError('WALLET_SERVICE_UNAVAILABLE');
    return new PrismaWalletRepository(client);
  }
}
const lifecycle = new Set<PropertyKey>(['then', 'onModuleInit', 'onModuleDestroy']);
function forward(source: ApiWalletRepository): WalletRepository {
  return new Proxy({} as WalletRepository, {
    get: (_target, property) => {
      if (lifecycle.has(property)) return undefined;
      const repository = source.get();
      const value = Reflect.get(repository, property) as unknown;
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-return -- typed port forwarding. */
      return typeof value === 'function' ? value.bind(repository) : value;
    },
  });
}
const clock = new SystemClock();
export const walletProviders: Provider[] = [
  ApiWalletRepository,
  {
    provide: WALLET_QUERY_SERVICE,
    inject: [ApiWalletRepository],
    useFactory: (source: ApiWalletRepository) => new WalletQueryService(forward(source), clock),
  },
  {
    provide: ADMIN_WALLET_SERVICE,
    inject: [ApiWalletRepository],
    useFactory: (source: ApiWalletRepository) => {
      const repository = forward(source);
      return new AdminWalletService(repository, new WalletLedgerService(repository, clock));
    },
  },
  {
    provide: WALLET_RECONCILIATION_SERVICE,
    inject: [ApiWalletRepository],
    useFactory: (source: ApiWalletRepository) =>
      new WalletReconciliationService(forward(source), clock),
  },
  { provide: WALLET_AUTHORIZATION, useExisting: DatabaseAuthorizationService },
];
