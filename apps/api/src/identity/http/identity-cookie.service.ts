import { Inject, Injectable } from '@nestjs/common';
import type { ApiServiceConfig } from '@arena-core/config';
import { parse } from 'cookie';
import { API_CONFIG } from '../../config/config.module';
import type { HttpResponse, PrincipalRequest } from './identity-http.types';

@Injectable()
export class IdentityCookieService {
  public constructor(@Inject(API_CONFIG) private readonly config: ApiServiceConfig) {}

  public read(request: PrincipalRequest): string | undefined {
    const header = request.headers.cookie;
    if (typeof header !== 'string' || header.length === 0 || header.length > 8192) return undefined;
    try {
      const value = parse(header)[this.config.identityHttp.cookie.name];
      return value !== undefined && /^[A-Za-z0-9_-]{20,512}$/.test(value) ? value : undefined;
    } catch {
      return undefined;
    }
  }

  public set(response: HttpResponse, token: string, expiresAt: Date): void {
    response.cookie(this.config.identityHttp.cookie.name, token, {
      ...this.options(),
      maxAge: this.config.identityHttp.cookie.maxAgeSeconds * 1000,
      expires: expiresAt,
    });
  }

  public clear(response: HttpResponse): void {
    response.clearCookie(this.config.identityHttp.cookie.name, this.options());
  }

  private options(): Record<string, unknown> {
    const cookie = this.config.identityHttp.cookie;
    return {
      httpOnly: true,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      ...(cookie.domain === undefined ? {} : { domain: cookie.domain }),
    };
  }
}
