import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ApiServiceConfig } from '@arena-core/config';
import type { Observable } from 'rxjs';
import { API_CONFIG } from '../../config/config.module';
import type { HttpResponse, PrincipalRequest } from './identity-http.types';

export type RateLimitBucket =
  'login' | 'register' | 'token' | 'game-account' | 'matchmaking' | 'matches' | 'wallet';
export const RATE_LIMIT_BUCKET = Symbol('RATE_LIMIT_BUCKET');

export const RateLimit = (bucket: RateLimitBucket) => SetMetadata(RATE_LIMIT_BUCKET, bucket);

interface Entry {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  readonly #entries = new Map<string, Entry>();

  public constructor(
    private readonly reflector: Reflector,
    @Inject(API_CONFIG) private readonly config: ApiServiceConfig,
  ) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const bucket = this.reflector.getAllAndOverride<RateLimitBucket | undefined>(
      RATE_LIMIT_BUCKET,
      [context.getHandler(), context.getClass()],
    );
    if (bucket === undefined) return next.handle();
    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    const response = context.switchToHttp().getResponse<HttpResponse>();
    const policy =
      bucket === 'game-account' ||
      bucket === 'matchmaking' ||
      bucket === 'matches' ||
      bucket === 'wallet'
        ? this.config.identityHttp.rateLimit.token
        : this.config.identityHttp.rateLimit[bucket];
    const now = Date.now();
    if (this.#entries.size > 10_000) this.cleanup(now);
    const key = `${bucket}:${request.principal?.userId ?? request.ip ?? 'unknown'}`;
    const previous = this.#entries.get(key);
    const entry =
      previous === undefined || previous.resetAt <= now
        ? { count: 1, resetAt: now + policy.windowSeconds * 1000 }
        : { count: previous.count + 1, resetAt: previous.resetAt };
    this.#entries.set(key, entry);
    if (entry.count > policy.maximum) {
      response.setHeader('Retry-After', Math.max(1, Math.ceil((entry.resetAt - now) / 1000)));
      throw new HttpException('Too many requests.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return next.handle();
  }

  private cleanup(now: number): void {
    for (const [key, entry] of this.#entries) {
      if (entry.resetAt <= now) this.#entries.delete(key);
    }
    while (this.#entries.size > 10_000) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }
}
