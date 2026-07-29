import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { ApiServiceConfig } from '@arena-core/config';
import { API_CONFIG } from '../../config/config.module';
import type { PrincipalRequest } from './identity-http.types';

@Injectable()
export class IdentitySecurityGuard implements CanActivate {
  public constructor(@Inject(API_CONFIG) private readonly config: ApiServiceConfig) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method.toUpperCase())) return true;
    const contentType = request.headers['content-type'];
    if (
      typeof contentType !== 'string' ||
      !contentType.toLowerCase().startsWith('application/json')
    ) {
      throw new HttpException('Unsupported media type.', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
    const origin = request.headers.origin;
    if (origin === undefined && !this.config.identityHttp.requireOrigin) return true;
    if (typeof origin !== 'string' || !this.config.identityHttp.allowedOrigins.includes(origin)) {
      throw new HttpException('Origin is not allowed.', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
