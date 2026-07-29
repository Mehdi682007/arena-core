import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { identityProviders, IDENTITY_SERVICES } from './identity.providers';
import { IdentityController } from './http/identity.controller';
import { IdentityCookieService } from './http/identity-cookie.service';
import { IdentityHttpExceptionFilter } from './http/identity-http.filter';
import { IdentityHttpInterceptor } from './http/identity-http.interceptor';
import { IDENTITY_MESSAGE_DISPATCHER } from './email/identity-email-dispatcher';
import { IdentitySecurityGuard } from './http/identity-security.guard';
import { RateLimitInterceptor } from './http/rate-limit.interceptor';
import { SessionAuthGuard } from './http/guards/session-auth.guard';
import type { IdentityServiceCollection } from './identity.providers';
import type { IdentityMessageDispatcher } from './email/identity-email-dispatcher';

export interface IdentityModuleOverrides {
  readonly services?: IdentityServiceCollection;
  readonly dispatcher?: IdentityMessageDispatcher;
}

@Module({})
export class IdentityModule {
  public static register(overrides: IdentityModuleOverrides = {}): DynamicModule {
    const services: Provider[] =
      overrides.services === undefined
        ? identityProviders
        : [{ provide: IDENTITY_SERVICES, useValue: overrides.services }];
    const dispatcher: Provider[] =
      overrides.dispatcher === undefined
        ? []
        : [{ provide: IDENTITY_MESSAGE_DISPATCHER, useValue: overrides.dispatcher }];
    return {
      module: IdentityModule,
      controllers: [IdentityController],
      providers: [
        ...services,
        IdentityCookieService,
        ...dispatcher,
        { provide: APP_GUARD, useClass: IdentitySecurityGuard },
        { provide: APP_GUARD, useClass: SessionAuthGuard },
        { provide: APP_INTERCEPTOR, useClass: IdentityHttpInterceptor },
        { provide: APP_INTERCEPTOR, useClass: RateLimitInterceptor },
        { provide: APP_FILTER, useClass: IdentityHttpExceptionFilter },
      ],
      exports: [IDENTITY_SERVICES],
    };
  }
}
