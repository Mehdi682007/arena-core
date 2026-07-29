import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import { requestContext } from './request-context';

@Catch()
export class PlatformErrorFilter implements ExceptionFilter {
  public catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status(code: number): { json(body: unknown): void };
    }>();
    const status =
      error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const code =
      status === 413
        ? 'REQUEST_TOO_LARGE'
        : status === 429
          ? 'RATE_LIMITED'
          : status === 401
            ? 'UNAUTHENTICATED'
            : status === 403
              ? 'FORBIDDEN'
              : status >= 500
                ? 'INTERNAL_ERROR'
                : 'REQUEST_INVALID';
    response.status(status).json({
      error: {
        code,
        message:
          status >= 500
            ? 'The service could not complete the request.'
            : 'The request could not be completed.',
        requestId: requestContext.get()?.requestId,
      },
    });
  }
}
