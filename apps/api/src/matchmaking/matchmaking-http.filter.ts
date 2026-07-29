import { ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import { MatchmakingError } from '@arena-core/matchmaking';

const status = {
  MATCHMAKING_REQUEST_NOT_FOUND: HttpStatus.NOT_FOUND,
  MATCHMAKING_ACTIVE_REQUEST_EXISTS: HttpStatus.CONFLICT,
  MATCHMAKING_ACCOUNT_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  MATCHMAKING_CATALOG_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  MATCHMAKING_RULESET_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  MATCHMAKING_REQUEST_EXPIRED: HttpStatus.GONE,
  MATCHMAKING_REQUEST_STATE_INVALID: HttpStatus.CONFLICT,
  MATCHMAKING_PROPOSAL_NOT_FOUND: HttpStatus.NOT_FOUND,
  MATCHMAKING_PROPOSAL_EXPIRED: HttpStatus.GONE,
  MATCHMAKING_PROPOSAL_STATE_INVALID: HttpStatus.CONFLICT,
  MATCHMAKING_PROPOSAL_OWNERSHIP_INVALID: HttpStatus.FORBIDDEN,
  MATCHMAKING_COMPATIBILITY_FAILURE: HttpStatus.UNPROCESSABLE_ENTITY,
  MATCHMAKING_CONFLICT: HttpStatus.CONFLICT,
  MATCHMAKING_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  MATCHMAKING_PERSISTENCE_FAILURE: HttpStatus.SERVICE_UNAVAILABLE,
  MATCHMAKING_CRITERIA_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
} as const;
@Catch(MatchmakingError)
export class MatchmakingHttpFilter implements ExceptionFilter<MatchmakingError> {
  public catch(exception: MatchmakingError, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<{ status(code: number): { json(body: unknown): void } }>()
      .status(status[exception.code])
      .json({
        error: { code: exception.code, message: 'Matchmaking request could not be completed.' },
      });
  }
}
