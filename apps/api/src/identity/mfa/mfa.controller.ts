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
import type { ApiServiceConfig } from '@arena-core/config';
import type { MfaService } from '@arena-core/identity';
import { API_CONFIG } from '../../config/config.module';
import { IDENTITY_SERVICES, type IdentityServiceCollection } from '../identity.providers';
import { CurrentPrincipal } from '../http/decorators/current-principal.decorator';
import { Public } from '../http/decorators/public.decorator';
import {
  mfaEnrollmentConfirmSchema,
  mfaEnrollmentStartSchema,
  mfaLoginChallengeConfirmSchema,
  ZodBodyPipe,
  type MfaEnrollmentConfirmRequest,
  type MfaEnrollmentStartRequest,
  type MfaLoginChallengeConfirmRequest,
} from '../http/dto/identity.dto';
import { IdentityCookieService } from '../http/identity-cookie.service';
import type {
  AuthenticatedPrincipal,
  HttpResponse,
  PrincipalRequest,
} from '../http/identity-http.types';
import { RateLimit } from '../http/rate-limit.interceptor';
import { MFA_SERVICE } from './mfa.providers';

@Controller('auth/mfa')
export class MfaController {
  public constructor(
    @Inject(MFA_SERVICE)
    private readonly mfa: MfaService,

    @Inject(IDENTITY_SERVICES)
    private readonly services: IdentityServiceCollection,

    private readonly cookies: IdentityCookieService,

    @Inject(API_CONFIG)
    private readonly config: ApiServiceConfig,
  ) {}

  @Get()
  public async status(
    @CurrentPrincipal()
    principal: AuthenticatedPrincipal,
  ) {
    const result = await this.mfa.status(principal.userId);

    return {
      enabled: result.enabled,
      enabledAt: result.enabledAt?.toISOString() ?? null,
      recoveryCodesRemaining: result.recoveryCodesRemaining,
    };
  }

  @RateLimit('token')
  @HttpCode(HttpStatus.OK)
  @Post('totp/enroll/start')
  public async start(
    @Body(new ZodBodyPipe(mfaEnrollmentStartSchema))
    input: MfaEnrollmentStartRequest,

    @CurrentPrincipal()
    principal: AuthenticatedPrincipal,
  ) {
    void input;

    return this.mfa.startTotpEnrollment(principal.userId);
  }

  @RateLimit('token')
  @HttpCode(HttpStatus.OK)
  @Post('totp/enroll/confirm')
  public async confirm(
    @Body(new ZodBodyPipe(mfaEnrollmentConfirmSchema))
    input: MfaEnrollmentConfirmRequest,

    @CurrentPrincipal()
    principal: AuthenticatedPrincipal,
  ) {
    const result = await this.mfa.confirmTotpEnrollment(
      principal.userId,
      principal.sessionId,
      input.code,
    );

    return {
      enabled: true,
      recoveryCodes: result.recoveryCodes,
    };
  }

  @Public()
  @RateLimit('login')
  @HttpCode(HttpStatus.OK)
  @Post('challenge/confirm')
  public async confirmLoginChallenge(
    @Body(new ZodBodyPipe(mfaLoginChallengeConfirmSchema))
    input: MfaLoginChallengeConfirmRequest,

    @Req()
    request: PrincipalRequest,

    @Res({ passthrough: true })
    response: HttpResponse,
  ) {
    const verified = await this.mfa.confirmLoginChallenge(input);

    const clientIp = this.clientIp(request);

    const session = await this.services.sessions.createSession({
      userId: verified.userId,
      securityVersion: verified.securityVersion,
      mfaVerifiedAt: verified.mfaVerifiedAt,
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
        id: verified.userId,
        status: 'ACTIVE',
      },
      session: {
        expiresAt: session.expiresAt.toISOString(),
        mfaVerifiedAt: verified.mfaVerifiedAt.toISOString(),
      },
    };
  }

  private clientIp(request: PrincipalRequest): string | undefined {
    return ['development', 'test'].includes(this.config.runtime.environment)
      ? request.ip
      : undefined;
  }
}
