import { ArgumentsHost, Catch, HttpStatus, type ExceptionFilter } from '@nestjs/common';
import { RatingError } from '@arena-core/rating';

const statuses: Record<string, number> = {
  RATING_NOT_FOUND: 404,
  RATING_APPLICATION_NOT_ELIGIBLE: 422,
  RATING_APPLICATION_DELAY_NOT_ELAPSED: 409,
  RATING_APPLICATION_ACTIVE_DISPUTE: 409,
  RATING_APPLICATION_ALREADY_EXISTS: 409,
  RATING_APPLICATION_IDEMPOTENCY_CONFLICT: 409,
  RATING_APPLICATION_RESULT_INVALID: 422,
  RATING_APPLICATION_PARTICIPANT_INVALID: 422,
  RATING_POLICY_INVALID: 422,
  RATING_INVARIANT_VIOLATION: 409,
  LEADERBOARD_UNAVAILABLE: 503,
  RATING_SERVICE_UNAVAILABLE: 503,
  RATING_PERSISTENCE_FAILURE: 503,
};

@Catch(RatingError)
export class RatingsHttpFilter implements ExceptionFilter {
  public catch(error: RatingError, host: ArgumentsHost): void {
    const unavailable = [
      'LEADERBOARD_UNAVAILABLE',
      'RATING_SERVICE_UNAVAILABLE',
      'RATING_PERSISTENCE_FAILURE',
    ].includes(error.code);
    host
      .switchToHttp()
      .getResponse<{ status(code: number): { json(body: unknown): void } }>()
      .status(statuses[error.code] ?? HttpStatus.INTERNAL_SERVER_ERROR)
      .json({
        error: {
          code: unavailable ? 'RATING_SERVICE_UNAVAILABLE' : error.code,
          message: 'Rating operation could not be completed.',
        },
      });
  }
}
