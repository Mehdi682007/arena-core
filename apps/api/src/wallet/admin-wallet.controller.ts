import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import type { AdminWalletService, WalletReconciliationService } from '@arena-core/wallet';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { RateLimit } from '../identity/http/rate-limit.interceptor';
import {
  adjustSchema,
  issueSchema,
  reverseSchema,
  transactionIdSchema,
  userIdSchema,
} from './wallet.dto';
import { RequireWalletPermission, WalletPermissionGuard } from './wallet-permission.guard';
import { ADMIN_WALLET_SERVICE, WALLET_RECONCILIATION_SERVICE } from './wallet.providers';

const safeTransaction = (transaction: {
  id: string;
  status: string;
  type?: string;
  direction?: string;
  amount?: bigint;
  balanceAfter?: bigint;
  reversedById?: string | null;
}) => ({
  id: transaction.id,
  status: transaction.status,
  ...(transaction.type === undefined ? {} : { type: transaction.type }),
  ...(transaction.direction === undefined ? {} : { direction: transaction.direction }),
  ...(transaction.amount === undefined ? {} : { amount: transaction.amount.toString() }),
  ...(transaction.balanceAfter === undefined
    ? {}
    : { balanceAfter: transaction.balanceAfter.toString() }),
  ...(transaction.reversedById === undefined ? {} : { reversedById: transaction.reversedById }),
});

@Controller('admin/wallets')
@UseGuards(WalletPermissionGuard)
export class AdminWalletController {
  public constructor(
    @Inject(ADMIN_WALLET_SERVICE) private readonly service: AdminWalletService,
    @Inject(WALLET_RECONCILIATION_SERVICE)
    private readonly reconciliation: WalletReconciliationService,
  ) {}
  @Get(':userId')
  @RequireWalletPermission('wallets.read')
  public get(@Param('userId', new ZodBodyPipe(userIdSchema)) userId: string) {
    return this.service.get(userId).then((wallet) =>
      wallet === null
        ? null
        : {
            id: wallet.id,
            userId: wallet.userId,
            status: wallet.status,
            assetCode: 'ARENA_POINT',
            balance: wallet.balance.toString(),
            updatedAt: wallet.updatedAt,
          },
    );
  }
  @Post(':userId/issue')
  @RateLimit('wallet')
  @RequireWalletPermission('wallets.issue')
  public issue(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('userId', new ZodBodyPipe(userIdSchema)) userId: string,
    @Body(new ZodBodyPipe(issueSchema))
    body: {
      amount: string;
      idempotencyKey: string;
      reasonCode: 'FOUNDATION_TEST' | 'PROMOTIONAL_GRANT' | 'OPERATIONAL_CORRECTION' | 'OTHER';
      note?: string;
    },
  ) {
    return this.service
      .issue({
        ...body,
        userId,
        actorUserId: actor.userId,
        amount: BigInt(body.amount),
      })
      .then(safeTransaction);
  }
  @Post(':userId/adjust')
  @RateLimit('wallet')
  @RequireWalletPermission('wallets.adjust')
  public adjust(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('userId', new ZodBodyPipe(userIdSchema)) userId: string,
    @Body(new ZodBodyPipe(adjustSchema))
    body: {
      amount: string;
      direction: 'DEBIT' | 'CREDIT';
      idempotencyKey: string;
      reasonCode: 'FOUNDATION_TEST' | 'PROMOTIONAL_GRANT' | 'OPERATIONAL_CORRECTION' | 'OTHER';
      note?: string;
    },
  ) {
    return this.service
      .adjust({
        ...body,
        userId,
        actorUserId: actor.userId,
        amount: BigInt(body.amount),
      })
      .then(safeTransaction);
  }
  @Post('transactions/:transactionId/reverse')
  @RateLimit('wallet')
  @RequireWalletPermission('wallets.reverse')
  public reverse(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('transactionId', new ZodBodyPipe(transactionIdSchema)) transactionId: string,
    @Body(new ZodBodyPipe(reverseSchema))
    body: {
      idempotencyKey: string;
      reasonCode: 'FOUNDATION_TEST' | 'PROMOTIONAL_GRANT' | 'OPERATIONAL_CORRECTION' | 'OTHER';
      note?: string;
    },
  ) {
    return this.service
      .reverse({ ...body, transactionId, actorUserId: actor.userId })
      .then(safeTransaction);
  }
  @Post(':userId/reconcile')
  @RateLimit('wallet')
  @RequireWalletPermission('wallets.reconcile')
  public reconcile(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('userId', new ZodBodyPipe(userIdSchema)) userId: string,
  ) {
    return this.reconciliation.reconcile(userId, actor.userId).then((result) => ({
      consistent: result.consistent,
      storedBalance: result.storedBalance.toString(),
      derivedBalance: result.derivedBalance.toString(),
      difference: result.difference.toString(),
    }));
  }
}
