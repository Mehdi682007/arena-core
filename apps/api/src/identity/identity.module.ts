import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import type { MfaService, PhoneOtpService } from '@arena-core/identity';
import { identityProviders, IDENTITY_SERVICES } from './identity.providers';
import type { IdentityServiceCollection } from './identity.providers';
import {
  IDENTITY_MESSAGE_DISPATCHER,
  type IdentityMessageDispatcher,
} from './email/identity-email-dispatcher';
import { IdentityController } from './http/identity.controller';
import { IdentityCookieService } from './http/identity-cookie.service';
import { IdentityHttpExceptionFilter } from './http/identity-http.filter';
import { IdentityHttpInterceptor } from './http/identity-http.interceptor';
import { IdentitySecurityGuard } from './http/identity-security.guard';
import { SessionAuthGuard } from './http/guards/session-auth.guard';
import { AdminMfaGuard } from './http/guards/admin-mfa.guard';
import { RateLimitInterceptor } from './http/rate-limit.interceptor';
import { MfaController } from './mfa/mfa.controller';
import { mfaProviders, MFA_SERVICE } from './mfa/mfa.providers';
import {
  DisabledIdentitySmsDispatcher,
  IDENTITY_SMS_DISPATCHER,
  type IdentitySmsDispatcher,
} from './phone/identity-sms-dispatcher';
import { PhoneIdentityController } from './phone/phone-identity.controller';
import { phoneIdentityProviders, PHONE_OTP_SERVICE } from './phone/phone-identity.providers';

export interface IdentityModuleOverrides {
  readonly services?: IdentityServiceCollection;
  readonly dispatcher?: IdentityMessageDispatcher;
  readonly phoneService?: PhoneOtpService;
  readonly smsDispatcher?: IdentitySmsDispatcher;
  readonly mfaService?: MfaService;
}

@Module({})
export class IdentityModule {
  public static register(overrides: IdentityModuleOverrides = {}): DynamicModule {
    const services: Provider[] =
      overrides.services === undefined
        ? identityProviders
        : [
            {
              provide: IDENTITY_SERVICES,
              useValue: overrides.services,
            },
          ];

    const dispatcher: Provider[] =
      overrides.dispatcher === undefined
        ? []
        : [
            {
              provide: IDENTITY_MESSAGE_DISPATCHER,
              useValue: overrides.dispatcher,
            },
          ];

    const phoneServices: Provider[] =
      overrides.phoneService === undefined
        ? phoneIdentityProviders
        : [
            {
              provide: PHONE_OTP_SERVICE,
              useValue: overrides.phoneService,
            },
          ];

    const smsDispatcher: Provider =
      overrides.smsDispatcher === undefined
        ? {
            provide: IDENTITY_SMS_DISPATCHER,
            useClass: DisabledIdentitySmsDispatcher,
          }
        : {
            provide: IDENTITY_SMS_DISPATCHER,
            useValue: overrides.smsDispatcher,
          };

    const mfaServices: Provider[] =
      overrides.mfaService === undefined
        ? mfaProviders
        : [
            {
              provide: MFA_SERVICE,
              useValue: overrides.mfaService,
            },
          ];

    return {
      module: IdentityModule,
      controllers: [IdentityController, PhoneIdentityController, MfaController],
      providers: [
        ...services,
        ...phoneServices,
        ...mfaServices,
        IdentityCookieService,
        ...dispatcher,
        smsDispatcher,
        {
          provide: APP_GUARD,
          useClass: IdentitySecurityGuard,
        },
        { provide: APP_GUARD, useClass: SessionAuthGuard },
        { provide: APP_GUARD, useClass: AdminMfaGuard },
        {
          provide: APP_INTERCEPTOR,
          useClass: IdentityHttpInterceptor,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: RateLimitInterceptor,
        },
        {
          provide: APP_FILTER,
          useClass: IdentityHttpExceptionFilter,
        },
      ],
      exports: [IDENTITY_SERVICES, PHONE_OTP_SERVICE, MFA_SERVICE],
    };
  }
}
