import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import { IdentityError, ProfileError } from '@arena-core/identity';
import { EmailError } from '@arena-core/email';
import { CatalogError } from '@arena-core/game-catalog';

interface ErrorRequest {
  requestId?: string;
}

interface ErrorResponse {
  status(code: number): this;
  json(body: unknown): void;
}

const identityStatus: Record<string, number> = {
  INVALID_CREDENTIALS: 401,
  INVALID_EMAIL: 422,
  INVALID_PHONE: 422,
  INVALID_PHONE_OTP: 400,
  PHONE_ALREADY_IN_USE: 409,
  INVALID_MFA_CODE: 400,
  MFA_ALREADY_ENABLED: 409,
  MFA_NOT_ENROLLED: 409,
  WEAK_PASSWORD: 422,
  EMAIL_ALREADY_REGISTERED: 409,
  ACCOUNT_NOT_ACTIVE: 401,
  ACCOUNT_LOCKED: 429,
  INVALID_TOKEN: 400,
  EXPIRED_TOKEN: 400,
  CONSUMED_TOKEN: 400,
  SESSION_INVALID: 401,
  SESSION_EXPIRED: 401,
  SESSION_REVOKED: 401,
  IDENTITY_CONFLICT: 409,
  IDENTITY_PERSISTENCE_FAILURE: 503,
  IDENTITY_DATABASE_DISABLED: 503,
};

const profileStatus: Record<string, number> = {
  PROFILE_NOT_AVAILABLE: 404,
  INVALID_DISPLAY_NAME: 422,
  INVALID_LOCALE: 422,
  INVALID_TIMEZONE: 422,
  INVALID_COUNTRY_CODE: 422,
  PROFILE_UPDATE_CONFLICT: 409,
  ONBOARDING_INCOMPLETE: 409,
  IDENTITY_NOT_ACTIVE: 409,
  IDENTITY_PROFILE_PERSISTENCE_FAILURE: 503,
  PROFILE_DATABASE_DISABLED: 503,
};

@Catch()
export class IdentityHttpExceptionFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<ErrorRequest>();
    const response = http.getResponse<ErrorResponse>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred.';
    let details: Record<string, string[]> | undefined;

    if (exception instanceof IdentityError) {
      status = identityStatus[exception.code] ?? 500;
      code = ['INVALID_TOKEN', 'EXPIRED_TOKEN', 'CONSUMED_TOKEN'].includes(exception.code)
        ? 'INVALID_OR_EXPIRED_TOKEN'
        : exception.code === 'IDENTITY_DATABASE_DISABLED' ||
            exception.code === 'IDENTITY_PERSISTENCE_FAILURE'
          ? 'IDENTITY_SERVICE_UNAVAILABLE'
          : exception.code;
      message =
        code === 'INVALID_OR_EXPIRED_TOKEN'
          ? 'Token is invalid or expired.'
          : code === 'IDENTITY_SERVICE_UNAVAILABLE'
            ? 'Identity service is temporarily unavailable.'
            : exception.message;
    } else if (exception instanceof ProfileError) {
      status = profileStatus[exception.code] ?? 500;
      const unavailable = ['IDENTITY_PROFILE_PERSISTENCE_FAILURE', 'PROFILE_DATABASE_DISABLED'];
      code = unavailable.includes(exception.code) ? 'PROFILE_SERVICE_UNAVAILABLE' : exception.code;
      message =
        code === 'PROFILE_SERVICE_UNAVAILABLE'
          ? 'Profile service is temporarily unavailable.'
          : exception.message;
    } else if (exception instanceof EmailError) {
      status = 503;
      code = 'IDENTITY_DELIVERY_UNAVAILABLE';
      message = 'Identity message delivery is temporarily unavailable.';
    } else if (exception instanceof CatalogError) {
      const mapping: Record<string, number> = {
        GAME_CATALOG_UNAVAILABLE: 503,
        CATALOG_NOT_FOUND: 404,
        CATALOG_CONFLICT: 409,
        INVALID_CATALOG_KEY: 422,
        INVALID_GAME_SLUG: 422,
        INVALID_CATALOG_VALUE: 422,
        INVALID_STATUS_TRANSITION: 409,
        RULESET_IMMUTABLE: 409,
        INVALID_RULESET_CONFIG: 422,
      };
      status = mapping[exception.code] ?? 500;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'object' && 'code' in payload) {
        const safe = payload as {
          code?: unknown;
          message?: unknown;
          details?: Record<string, string[]>;
        };
        code = typeof safe.code === 'string' ? safe.code : `HTTP_${String(status)}`;
        message = typeof safe.message === 'string' ? safe.message : 'Request failed.';
        details = safe.details;
      } else {
        const publicHttpErrors: Record<string, { code: string; message: string }> = {
          '401': { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
          '403': { code: 'CSRF_ORIGIN_REJECTED', message: 'Request origin is not allowed.' },
          '415': {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Content-Type must be application/json.',
          },
          '429': { code: 'RATE_LIMITED', message: 'Too many requests.' },
        };
        const mapped = publicHttpErrors[String(status)];
        code = mapped?.code ?? `HTTP_${String(status)}`;
        message = mapped?.message ?? 'Request failed.';
      }
    } else if (
      typeof exception === 'object' &&
      exception !== null &&
      'statusCode' in exception &&
      (exception.statusCode === 400 || exception.statusCode === 413)
    ) {
      const parserStatus = String(exception.statusCode);
      status = Number(parserStatus);
      code = parserStatus === '413' ? 'PAYLOAD_TOO_LARGE' : 'MALFORMED_JSON';
      message =
        parserStatus === '413'
          ? 'Request body is too large.'
          : 'Request body contains malformed JSON.';
    }
    response.status(status).json({
      error: {
        code,
        message,
        ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
        ...(details === undefined ? {} : { details }),
      },
    });
  }
}
