import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { MatchmakingRequestService } from '@arena-core/matchmaking';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { RateLimit } from '../identity/http/rate-limit.interceptor';
import {
  createMatchmakingRequestSchema,
  emptyMatchmakingActionSchema,
  matchmakingIdSchema,
  matchmakingLimitSchema,
} from './matchmaking.dto';
import { MATCHMAKING_REQUEST_SERVICE } from './matchmaking.providers';

@Controller('matchmaking/requests')
export class MatchmakingRequestController {
  public constructor(
    @Inject(MATCHMAKING_REQUEST_SERVICE) private readonly service: MatchmakingRequestService,
  ) {}
  @Get()
  public list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('limit', new ZodBodyPipe(matchmakingLimitSchema)) limit?: number,
  ) {
    return this.service.listMyRequests(principal.userId, limit);
  }
  @Post()
  @RateLimit('matchmaking')
  public create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body(new ZodBodyPipe(createMatchmakingRequestSchema))
    body: {
      userGameAccountId: string;
      gameModeId: string;
      gameRulesetId: string;
      searchScope?: 'CROSSPLAY_GROUP' | 'SAME_PLATFORM';
      criteria?: { language?: 'fa' | 'en'; region?: string };
    },
  ) {
    return this.service.createRequest({ userId: principal.userId, ...body });
  }
  @Get(':requestId')
  public get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('requestId', new ZodBodyPipe(matchmakingIdSchema)) requestId: string,
  ) {
    return this.service.getMyRequest(principal.userId, requestId);
  }
  @Post(':requestId/cancel')
  @RateLimit('matchmaking')
  @HttpCode(HttpStatus.NO_CONTENT)
  public cancel(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('requestId', new ZodBodyPipe(matchmakingIdSchema)) requestId: string,
    @Body(new ZodBodyPipe(emptyMatchmakingActionSchema)) body: Record<string, never>,
  ) {
    void body;
    return this.service.cancelMyRequest(principal.userId, requestId);
  }
}
