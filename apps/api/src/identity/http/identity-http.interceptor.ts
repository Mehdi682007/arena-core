import { randomUUID } from 'node:crypto';
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { HttpResponse } from './identity-http.types';

interface RequestWithId {
  headers: Readonly<Record<string, string | string[] | undefined>>;
  requestId?: string;
}

@Injectable()
export class IdentityHttpInterceptor implements NestInterceptor {
  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const response = context.switchToHttp().getResponse<HttpResponse>();
    const supplied = request.headers['x-request-id'];
    const requestId =
      typeof request.requestId === 'string'
        ? request.requestId
        : typeof supplied === 'string' && /^[A-Za-z0-9._-]{8,128}$/.test(supplied)
          ? supplied
          : randomUUID();
    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    return next.handle();
  }
}
