import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { ApiServiceConfig, Locale } from '@arena-core/config';
import type { PhoneOtpIssue, PhoneOtpService, UserPhoneView } from '@arena-core/identity';
import { API_CONFIG } from '../../config/config.module';
import { IDENTITY_SERVICES, type IdentityServiceCollection } from '../identity.providers';
import { CurrentPrincipal } from '../http/decorators/current-principal.decorator';
import { Public } from '../http/decorators/public.decorator';
import {
  phoneOtpConfirmSchema,
  phoneSignInRequestSchema,
  phoneVerificationRequestSchema,
  ZodBodyPipe,
  type PhoneOtpConfirmRequest,
  type PhoneSignInRequest,
  type PhoneVerificationRequest,
} from '../http/dto/identity.dto';
import { IdentityCookieService } from '../http/identity-cookie.service';
import type {
  AuthenticatedPrincipal,
  HttpResponse,
  PrincipalRequest,
} from '../http/identity-http.types';
import { RateLimit } from '../http/rate-limit.interceptor';
import { MFA_SERVICE } from '../mfa/mfa.providers';
import { IDENTITY_SMS_DISPATCHER, type IdentitySmsDispatcher } from './identity-sms-dispatcher';
import { PHONE_OTP_SERVICE } from './phone-identity.providers';

function safePhone(phone: UserPhoneView) {
  return {
    id: phone.id,
    phoneE164: phone.phoneE164,
    isPrimary: phone.isPrimary,
    verifiedAt: phone.verifiedAt?.toISOString() ?? null,
    createdAt: phone.createdAt.toISOString(),
  };
}

interface MfaLoginChallengeService {
  beginLoginChallenge(input: { userId: string; securityVersion: number }): Promise<
    | Readonly<{
        required: false;
      }>
    | Readonly<{
        required: true;
        challengeToken: string;
        expiresAt: Date;
      }>
  >;
}
@Controller('auth/phone')
export class PhoneIdentityController {
  public constructor(
    @Inject(PHONE_OTP_SERVICE)
    private readonly phoneOtp: PhoneOtpService,
    @Inject(IDENTITY_SERVICES)
    private readonly services: IdentityServiceCollection,
    @Inject(MFA_SERVICE)
    private readonly mfa: MfaLoginChallengeService,
    @Inject(IDENTITY_SMS_DISPATCHER)
    private readonly sms: IdentitySmsDispatcher,
    private readonly cookies: IdentityCookieService,
    @Inject(API_CONFIG)
    private readonly config: ApiServiceConfig,
  ) {}

  @Public()
  @RateLimit('token')
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('sign-in/request')
  public async requestSignIn(
    @Body(new ZodBodyPipe(phoneSignInRequestSchema))
    input: PhoneSignInRequest,
    @Req() request: PrincipalRequest,
  ) {
    const requestedIp = this.clientIp(request);

    const issued = await this.phoneOtp.requestSignIn({
      phone: input.phone,
      ...(requestedIp === undefined
        ? {}
        : {
            requestedIp,
          }),
    });

    await this.dispatch(issued, input.locale ?? 'fa');

    return {
      accepted: true,
      challengeId: issued.challengeId,
      expiresAt: issued.expiresAt.toISOString(),
    };
  }

  @Public()
  @RateLimit('login')
  @HttpCode(HttpStatus.OK)
  @Post('sign-in/confirm')
  public async confirmSignIn(
    @Body(new ZodBodyPipe(phoneOtpConfirmSchema))
    input: PhoneOtpConfirmRequest,

    @Req()
    request: PrincipalRequest,

    @Res({ passthrough: true })
    response: HttpResponse,
  ) {
    const authenticated = await this.phoneOtp.confirmSignIn(input);

    const challenge = await this.mfa.beginLoginChallenge({
      userId: authenticated.userId,
      securityVersion: authenticated.securityVersion,
    });

    if (challenge.required) {
      return {
        mfaRequired: true,
        challengeToken: challenge.challengeToken,
        expiresAt: challenge.expiresAt.toISOString(),
      };
    }

    const clientIp = this.clientIp(request);

    const session = await this.services.sessions.createSession({
      userId: authenticated.userId,
      securityVersion: authenticated.securityVersion,
      ...(clientIp === undefined
        ? {}
        : {
            ip: clientIp,
          }),
      ...(typeof request.headers['user-agent'] === 'string'
        ? {
            userAgent: request.headers['user-agent'],
          }
        : {}),
    });

    this.cookies.set(response, session.token, session.expiresAt);

    return {
      user: {
        id: authenticated.userId,
        status: 'ACTIVE',
      },
      session: {
        expiresAt: session.expiresAt.toISOString(),
      },
    };
  }

  @Get()
  public async list(
    @CurrentPrincipal()
    principal: AuthenticatedPrincipal,
  ) {
    const phones = await this.phoneOtp.listUserPhones(principal.userId);

    return {
      items: phones.map(safePhone),
    };
  }

  @RateLimit('token')
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('verification/request')
  public async requestVerification(
    @Body(new ZodBodyPipe(phoneVerificationRequestSchema))
    input: PhoneVerificationRequest,
    @CurrentPrincipal()
    principal: AuthenticatedPrincipal,
    @Req() request: PrincipalRequest,
  ) {
    const requestedIp = this.clientIp(request);

    const issued = await this.phoneOtp.requestVerification({
      userId: principal.userId,
      phone: input.phone,
      ...(requestedIp === undefined
        ? {}
        : {
            requestedIp,
          }),
    });

    await this.dispatch(issued, input.locale ?? 'fa');

    return {
      accepted: true,
      challengeId: issued.challengeId,
      expiresAt: issued.expiresAt.toISOString(),
    };
  }

  @RateLimit('token')
  @HttpCode(HttpStatus.OK)
  @Post('verification/confirm')
  public async confirmVerification(
    @Body(new ZodBodyPipe(phoneOtpConfirmSchema))
    input: PhoneOtpConfirmRequest,
    @CurrentPrincipal()
    principal: AuthenticatedPrincipal,
  ) {
    const phone = await this.phoneOtp.confirmVerification({
      userId: principal.userId,
      challengeId: input.challengeId,
      code: input.code,
    });

    return {
      phone: safePhone(phone),
    };
  }

  private async dispatch(issued: PhoneOtpIssue, locale: Locale): Promise<void> {
    if (issued.delivery === undefined) {
      return;
    }

    try {
      await this.sms.sendOtp({
        to: issued.delivery.to,
        code: issued.delivery.code,
        locale,
        purpose: issued.purpose,
        expiresAt: issued.expiresAt,
      });
    } catch {
      // Delivery failures are deliberately not
      // reflected to the client to avoid account
      // enumeration through phone sign-in.
      return;
    }
  }

  private clientIp(request: PrincipalRequest): string | undefined {
    return ['development', 'test'].includes(this.config.runtime.environment)
      ? request.ip
      : undefined;
  }
}
