import { ArgumentsHost, Catch, HttpStatus, type ExceptionFilter } from '@nestjs/common';
import { MatchFinanceError, MatchSettlementError } from '@arena-core/match-finance';

const statuses: Record<string, number> = {
  MATCH_ENTRY_RESERVATION_NOT_FOUND: 404,
  MATCH_ENTRY_RESERVATION_ALREADY_EXISTS: 409,
  MATCH_ENTRY_RESERVATION_INSUFFICIENT_BALANCE: 409,
  MATCH_ENTRY_RESERVATION_EXPIRED: 410,
  MATCH_ENTRY_RESERVATION_STATE_INVALID: 409,
  MATCH_ENTRY_RESERVATION_MATCH_INVALID: 422,
  MATCH_ENTRY_RESERVATION_PARTICIPANT_INVALID: 403,
  MATCH_ENTRY_RESERVATION_IDEMPOTENCY_CONFLICT: 409,
  MATCH_ENTRY_RESERVATION_REFUND_NOT_ALLOWED: 409,
  MATCH_ENTRY_RESERVATION_RELEASE_NOT_ALLOWED: 409,
  MATCH_ESCROW_INVARIANT_VIOLATION: 409,
  MATCH_FINANCE_SERVICE_UNAVAILABLE: 503,
  MATCH_FINANCE_PERSISTENCE_FAILURE: 503,
  MATCH_SETTLEMENT_NOT_FOUND: 404,
  MATCH_SETTLEMENT_ALREADY_EXISTS: 409,
  MATCH_SETTLEMENT_NOT_ELIGIBLE: 422,
  MATCH_SETTLEMENT_DELAY_NOT_ELAPSED: 409,
  MATCH_SETTLEMENT_ACTIVE_DISPUTE: 409,
  MATCH_SETTLEMENT_RESULT_INVALID: 422,
  MATCH_SETTLEMENT_RESERVATION_INVALID: 422,
  MATCH_SETTLEMENT_ESCROW_MISMATCH: 409,
  MATCH_SETTLEMENT_IDEMPOTENCY_CONFLICT: 409,
  MATCH_SETTLEMENT_ALREADY_FINAL: 409,
  MATCH_SETTLEMENT_SERVICE_UNAVAILABLE: 503,
  MATCH_SETTLEMENT_PERSISTENCE_FAILURE: 503,
};

@Catch(MatchFinanceError, MatchSettlementError)
export class MatchFinanceHttpFilter implements ExceptionFilter {
  public catch(error: MatchFinanceError | MatchSettlementError, host: ArgumentsHost): void {
    const unavailable = [
      'MATCH_FINANCE_SERVICE_UNAVAILABLE',
      'MATCH_FINANCE_PERSISTENCE_FAILURE',
      'MATCH_SETTLEMENT_SERVICE_UNAVAILABLE',
      'MATCH_SETTLEMENT_PERSISTENCE_FAILURE',
    ].includes(error.code);
    host
      .switchToHttp()
      .getResponse<{ status(code: number): { json(body: unknown): void } }>()
      .status(statuses[error.code] ?? HttpStatus.INTERNAL_SERVER_ERROR)
      .json({
        error: {
          code: unavailable
            ? error instanceof MatchSettlementError
              ? 'MATCH_SETTLEMENT_SERVICE_UNAVAILABLE'
              : 'MATCH_FINANCE_SERVICE_UNAVAILABLE'
            : error.code,
          message:
            error instanceof MatchSettlementError
              ? 'Match settlement operation could not be completed.'
              : 'Match entry operation could not be completed.',
        },
      });
  }
}
