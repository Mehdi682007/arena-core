import { ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import { PlayerIdentityError } from '@arena-core/player-identity';

const statusByCode = {
  PLAYER_IDENTITY_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  GAME_ACCOUNT_NOT_FOUND: HttpStatus.NOT_FOUND,
  GAME_ACCOUNT_CONFLICT: HttpStatus.CONFLICT,
  GAME_ACCOUNT_HANDLE_CONFLICT: HttpStatus.CONFLICT,
  GAME_ACCOUNT_PLATFORM_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  GAME_ACCOUNT_STATUS_TRANSITION_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  GAME_ACCOUNT_NOT_VERIFIED: HttpStatus.UNPROCESSABLE_ENTITY,
  GAME_ACCOUNT_ALREADY_PRIMARY: HttpStatus.CONFLICT,
  GAME_ACCOUNT_PERMISSION_DENIED: HttpStatus.FORBIDDEN,
  GAME_ACCOUNT_VERIFICATION_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  GAME_ACCOUNT_VERSION_CONFLICT: HttpStatus.CONFLICT,
  GAME_ACCOUNT_PERSISTENCE_FAILURE: HttpStatus.SERVICE_UNAVAILABLE,
  GAME_ACCOUNT_QUERY_INVALID: HttpStatus.BAD_REQUEST,
  INVALID_PLATFORM_HANDLE: HttpStatus.UNPROCESSABLE_ENTITY,
} as const;
@Catch(PlayerIdentityError)
export class PlayerIdentityHttpFilter implements ExceptionFilter<PlayerIdentityError> {
  public catch(exception: PlayerIdentityError, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<{ status(code: number): { json(body: unknown): void } }>()
      .status(statusByCode[exception.code])
      .json({ error: { code: exception.code, message: exception.message } });
  }
}
