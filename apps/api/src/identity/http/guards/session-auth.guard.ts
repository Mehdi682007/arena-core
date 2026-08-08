import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { IdentityServiceCollection } from '../../identity.providers';
import { IDENTITY_SERVICES } from '../../identity.providers';
import { PUBLIC_ROUTE } from '../decorators/public.decorator';
import { IdentityCookieService } from '../identity-cookie.service';
import type { PrincipalRequest } from '../identity-http.types';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    private readonly cookies: IdentityCookieService,
    @Inject(IDENTITY_SERVICES) private readonly services: IdentityServiceCollection,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    const token = this.cookies.read(request);
    if (token === undefined) throw new UnauthorizedException();
    try {
      const validated = await this.services.sessions.validateSession(token);
      request.principal = Object.freeze({
        userId: validated.userId,
        sessionId: validated.sessionId,
        mfaVerifiedAt: validated.mfaVerifiedAt,
      });
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
