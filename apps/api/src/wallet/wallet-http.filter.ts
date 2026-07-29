import { ArgumentsHost, Catch, HttpStatus, type ExceptionFilter } from '@nestjs/common';
import { WalletError } from '@arena-core/wallet';
const statuses: Record<string, number> = {
  WALLET_NOT_FOUND: 404,
  WALLET_TRANSACTION_NOT_FOUND: 404,
  WALLET_PERMISSION_DENIED: 403,
  WALLET_SERVICE_UNAVAILABLE: 503,
  WALLET_PERSISTENCE_FAILURE: 503,
  WALLET_AMOUNT_INVALID: 422,
  WALLET_INSUFFICIENT_BALANCE: 409,
  WALLET_IDEMPOTENCY_CONFLICT: 409,
  WALLET_TRANSACTION_ALREADY_REVERSED: 409,
  WALLET_TRANSACTION_NOT_REVERSIBLE: 409,
  WALLET_SUSPENDED: 409,
  WALLET_CLOSED: 409,
  WALLET_RECONCILIATION_MISMATCH: 409,
};
@Catch(WalletError)
export class WalletHttpFilter implements ExceptionFilter {
  public catch(error: WalletError, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<{ status(code: number): { json(body: unknown): void } }>()
      .status(statuses[error.code] ?? HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: { code: error.code, message: 'Wallet operation could not be completed.' } });
  }
}
