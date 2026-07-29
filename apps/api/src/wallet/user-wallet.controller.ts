import { Controller, Get, Inject, Query } from '@nestjs/common';
import type { WalletQueryService } from '@arena-core/wallet';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { ledgerQuerySchema } from './wallet.dto';
import { WALLET_QUERY_SERVICE } from './wallet.providers';

@Controller('wallet')
export class UserWalletController {
  public constructor(@Inject(WALLET_QUERY_SERVICE) private readonly service: WalletQueryService) {}
  @Get()
  public get(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.service.getMine(principal.userId);
  }
  @Get('ledger')
  public list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodBodyPipe(ledgerQuerySchema))
    query: {
      limit: number;
      cursor?: string;
      type?:
        | 'ISSUANCE'
        | 'ADMIN_ADJUSTMENT'
        | 'REVERSAL'
        | 'MATCH_ENTRY_RESERVATION'
        | 'MATCH_ENTRY_REFUND';
      direction?: 'DEBIT' | 'CREDIT';
    },
  ) {
    return this.service.listMine(
      principal.userId,
      query.limit,
      query.cursor,
      query.type,
      query.direction,
    );
  }
}
