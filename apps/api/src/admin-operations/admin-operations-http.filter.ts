import { ArgumentsHost, Catch, HttpStatus, type ExceptionFilter } from '@nestjs/common';
import { AdminOperationError } from '@arena-core/admin-operations';
const statuses: Record<string, number> = {
  ADMIN_AUDIT_INVALID: 422,
  ADMIN_AUDIT_NOT_FOUND: 404,
  ADMIN_SEARCH_INVALID: 422,
  ADMIN_TARGET_NOT_FOUND: 404,
  ADMIN_OPERATIONS_UNAVAILABLE: 503,
  ADMIN_OPERATIONS_PERSISTENCE_FAILURE: 503,
};
@Catch(AdminOperationError)
export class AdminOperationsHttpFilter implements ExceptionFilter {
  public catch(error: AdminOperationError, host: ArgumentsHost) {
    const unavailable = error.code.includes('UNAVAILABLE') || error.code.includes('PERSISTENCE');
    host
      .switchToHttp()
      .getResponse<{ status(code: number): { json(body: unknown): void } }>()
      .status(statuses[error.code] ?? HttpStatus.INTERNAL_SERVER_ERROR)
      .json({
        error: {
          code: unavailable ? 'ADMIN_OPERATIONS_UNAVAILABLE' : error.code,
          message: 'Administrative operation could not be completed.',
        },
      });
  }
}
