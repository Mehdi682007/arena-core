import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { ApiServiceConfig } from '@arena-core/config';
import { API_CONFIG } from '../../config/config.module';
import { IDENTITY_SERVICES, type IdentityServiceCollection } from '../identity.providers';
import { CurrentPrincipal } from './decorators/current-principal.decorator';
import { Public } from './decorators/public.decorator';
import {
  changePasswordSchema,
  emailRequestSchema,
  loginSchema,
  registerSchema,
  resetConfirmSchema,
  sessionIdSchema,
  tokenSchema,
  ZodBodyPipe,
  type ChangePasswordRequest,
  type EmailRequest,
  type LoginRequest,
  type RegisterRequest,
  type ResetConfirmRequest,
  type TokenRequest,
} from './dto/identity.dto';
import { IdentityCookieService } from './identity-cookie.service';
import type { AuthenticatedPrincipal, HttpResponse, PrincipalRequest } from './identity-http.types';
import {
  IDENTITY_MESSAGE_DISPATCHER,
  type IdentityMessageDispatcher,
} from '../email/identity-email-dispatcher';
import { EmailError } from '@arena-core/email';
import { RateLimit } from './rate-limit.interceptor';

@Controller('auth')
export class IdentityController {
  public constructor(
    @Inject(IDENTITY_SERVICES) private readonly services: IdentityServiceCollection,
    @Inject(IDENTITY_MESSAGE_DISPATCHER)
    private readonly dispatcher: IdentityMessageDispatcher,
    private readonly cookies: IdentityCookieService,
    @Inject(API_CONFIG) private readonly config: ApiServiceConfig,
  ) {}

  @Public()
  @RateLimit('register')
  @Post('register')
  public async register(
    @Body(new ZodBodyPipe(registerSchema)) input: RegisterRequest,
  ): Promise<unknown> {
    const registered = await this.services.identity.registerUser({
      email: input.email,
      password: input.password,
      ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
      ...(input.locale === undefined ? {} : { locale: input.locale }),
      ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
      ...(input.countryCode === undefined ? {} : { countryCode: input.countryCode }),
    });
    let deliveryStatus: 'sent' | 'pending' = 'sent';
    try {
      await this.dispatcher.sendVerificationEmail({
        email: input.email.trim(),
        token: registered.verificationToken,
        expiresAt: registered.verificationExpiresAt,
        ...(input.locale === undefined ? {} : { locale: input.locale }),
        ...(input.displayName === undefined ? {} : { recipientName: input.displayName }),
      });
    } catch (error) {
      if (!(error instanceof EmailError)) throw error;
      deliveryStatus = 'pending';
    }
    return {
      userId: registered.userId,
      status: registered.status,
      verificationRequired: true,
      deliveryStatus,
    };
  }

  @Public()
  @RateLimit('login')
  @HttpCode(HttpStatus.OK)
  @Post('login')
  public async login(
    @Body(new ZodBodyPipe(loginSchema)) input: LoginRequest,
    @Req() request: PrincipalRequest,
    @Res({ passthrough: true }) response: HttpResponse,
  ): Promise<unknown> {
    const authenticated = await this.services.identity.authenticateWithPassword(input);
    const clientIp = this.clientIp(request);
    const session = await this.services.sessions.createSession({
      userId: authenticated.userId,
      securityVersion: authenticated.securityVersion,
      ...(clientIp === undefined ? {} : { ip: clientIp }),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    });
    this.cookies.set(response, session.token, session.expiresAt);
    return {
      user: { id: authenticated.userId, status: 'ACTIVE' },
      session: { expiresAt: session.expiresAt.toISOString() },
    };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  public async logout(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Res({ passthrough: true }) response: HttpResponse,
  ): Promise<void> {
    await this.services.sessions.revokeSession(principal.sessionId);
    this.cookies.clear(response);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout-all')
  public async logoutAll(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Res({ passthrough: true }) response: HttpResponse,
  ): Promise<void> {
    await this.services.sessions.revokeAllUserSessions(principal.userId);
    this.cookies.clear(response);
  }

  @Get('sessions')
  public async sessions(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<unknown> {
    const sessions = await this.services.sessions.listUserSessions(
      principal.userId,
      principal.sessionId,
    );
    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        status: session.status,
        current: session.current,
        createdAt: session.createdAt.toISOString(),
        lastSeenAt: session.lastSeenAt?.toISOString() ?? null,
        expiresAt: session.expiresAt.toISOString(),
        revokedAt: session.revokedAt?.toISOString() ?? null,
        userAgent: session.userAgent,
      })),
    };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('sessions/:sessionId/revoke')
  public async revokeUserSession(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('sessionId', new ZodBodyPipe(sessionIdSchema)) sessionId: string,
    @Res({ passthrough: true }) response: HttpResponse,
  ): Promise<void> {
    await this.services.sessions.revokeUserSession(principal.userId, sessionId);
    if (sessionId === principal.sessionId) this.cookies.clear(response);
  }

  @Public()
  @RateLimit('token')
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('email-verification/request')
  public async requestVerification(
    @Body(new ZodBodyPipe(emailRequestSchema)) input: EmailRequest,
  ): Promise<{ accepted: true }> {
    const issued = await this.services.emailVerification.requestEmailVerification(input);
    if (
      issued.email !== undefined &&
      issued.token !== undefined &&
      issued.expiresAt !== undefined
    ) {
      try {
        await this.dispatcher.sendVerificationEmail({
          email: issued.email,
          token: issued.token,
          expiresAt: issued.expiresAt,
        });
      } catch (error) {
        if (!(error instanceof EmailError)) throw error;
      }
    }
    return { accepted: true };
  }

  @Public()
  @RateLimit('token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('email-verification/confirm')
  public async confirmVerification(
    @Body(new ZodBodyPipe(tokenSchema)) input: TokenRequest,
  ): Promise<void> {
    await this.services.emailVerification.consumeEmailVerificationToken(input.token);
  }

  @Public()
  @RateLimit('token')
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('password-reset/request')
  public async requestReset(
    @Body(new ZodBodyPipe(emailRequestSchema)) input: EmailRequest,
    @Req() request: PrincipalRequest,
  ): Promise<{ accepted: true }> {
    const requestedIp = this.clientIp(request);
    const issued = await this.services.passwordReset.issuePasswordResetToken({
      email: input.email,
      ...(requestedIp === undefined ? {} : { requestedIp }),
    });
    if (issued.token !== undefined && issued.expiresAt !== undefined) {
      try {
        await this.dispatcher.sendPasswordResetEmail({
          email: input.email.trim(),
          token: issued.token,
          expiresAt: issued.expiresAt,
        });
      } catch (error) {
        if (!(error instanceof EmailError)) throw error;
      }
    }
    return { accepted: true };
  }

  @Public()
  @RateLimit('token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('password-reset/confirm')
  public async confirmReset(
    @Body(new ZodBodyPipe(resetConfirmSchema)) input: ResetConfirmRequest,
    @Res({ passthrough: true }) response: HttpResponse,
  ): Promise<void> {
    await this.services.passwordReset.consumePasswordResetToken(input);
    this.cookies.clear(response);
  }

  @RateLimit('token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('password/change')
  public async changePassword(
    @Body(new ZodBodyPipe(changePasswordSchema)) input: ChangePasswordRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Res({ passthrough: true }) response: HttpResponse,
  ): Promise<void> {
    await this.services.identity.changePassword({
      userId: principal.userId,
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    });
    this.cookies.clear(response);
  }

  @Get('me')
  public me(@CurrentPrincipal() principal: AuthenticatedPrincipal): unknown {
    return {
      user: { id: principal.userId, status: 'ACTIVE' },
      session: { id: principal.sessionId },
    };
  }

  private clientIp(request: PrincipalRequest): string | undefined {
    return ['development', 'test'].includes(this.config.runtime.environment)
      ? request.ip
      : undefined;
  }
}
