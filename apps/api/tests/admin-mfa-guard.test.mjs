import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AdminMfaGuard } from '../dist/identity/http/guards/admin-mfa.guard.js';

function context(controller, principal) {
  return {
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => ({
        principal,
      }),
    }),
  };
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class ProfileController {}

Reflect.defineMetadata(PATH_METADATA, 'profile', ProfileController);

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class AdminExampleController {}

Reflect.defineMetadata(PATH_METADATA, 'admin/example', AdminExampleController);

describe('Admin MFA guard', () => {
  const guard = new AdminMfaGuard(new Reflector());

  it('leaves non-admin routes unchanged', () => {
    expect(guard.canActivate(context(ProfileController, undefined))).toBe(true);
  });

  it('allows an MFA-verified admin session', () => {
    expect(
      guard.canActivate(
        context(AdminExampleController, {
          userId: 'user-1',
          sessionId: 'session-1',
          mfaVerifiedAt: new Date('2026-08-08T00:00:00Z'),
        }),
      ),
    ).toBe(true);
  });

  it('rejects a pre-MFA admin session', () => {
    expect(() =>
      guard.canActivate(
        context(AdminExampleController, {
          userId: 'user-1',
          sessionId: 'session-1',
          mfaVerifiedAt: null,
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects an admin request with no principal', () => {
    expect(() => guard.canActivate(context(AdminExampleController, undefined))).toThrow(
      ForbiddenException,
    );
  });
});
