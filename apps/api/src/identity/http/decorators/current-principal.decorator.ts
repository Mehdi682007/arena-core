import { createParamDecorator, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthenticatedPrincipal, PrincipalRequest } from '../identity-http.types';

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal => {
    const principal = context.switchToHttp().getRequest<PrincipalRequest>().principal;
    if (principal === undefined) throw new UnauthorizedException();
    return principal;
  },
);
