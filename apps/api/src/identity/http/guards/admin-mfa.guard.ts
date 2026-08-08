import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import type { PrincipalRequest } from '../identity-http.types';

function isAdminPath(value: unknown): boolean {
  if (typeof value === 'string') {
    return value === 'admin' || value.startsWith('admin/');
  }

  if (!Array.isArray(value)) {
    return false;
  }

  return value.some(
    (path: unknown) => typeof path === 'string' && (path === 'admin' || path.startsWith('admin/')),
  );
}

@Injectable()
export class AdminMfaGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const controller = context.getClass();

    const routePath = this.reflector.get<unknown>(PATH_METADATA, controller);

    const adminController = controller.name.startsWith('Admin') || isAdminPath(routePath);

    if (!adminController) {
      return true;
    }

    const request = context.switchToHttp().getRequest<PrincipalRequest>();

    if (!(request.principal?.mfaVerifiedAt instanceof Date)) {
      throw new ForbiddenException('MFA_REQUIRED');
    }

    return true;
  }
}
