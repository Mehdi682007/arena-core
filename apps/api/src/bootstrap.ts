import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication, LogLevel as NestLogLevel } from '@nestjs/common';
import type { ApiServiceConfig, LogLevel } from '@arena-core/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import type { IdentityModuleOverrides } from './identity/identity.module';
import type { ProfileModuleOverrides } from './profile/profile.module';
import type { GameCatalogModuleOverrides } from './game-catalog/game-catalog.module';
import type { PlayerIdentityModuleOverrides } from './player-identity/player-identity.module';
import type { MatchmakingModuleOverrides } from './matchmaking/matchmaking.module';
import type { MatchesModuleOverrides } from './matches/matches.module';
import type { WalletModuleOverrides } from './wallet/wallet.module';
import type { MatchFinanceModuleOverrides } from './match-finance/match-finance.module';
import type { RatingsModuleOverrides } from './ratings/ratings.module';
import type { NotificationsModuleOverrides } from './notifications/notifications.module';
import type { AdminOperationsModuleOverrides } from './admin-operations/admin-operations.module';
import { requestContext, validOpaqueId } from './platform/request-context';

const nestLogLevels: Record<Exclude<LogLevel, 'silent'>, NestLogLevel[]> = {
  fatal: ['fatal'],
  error: ['fatal', 'error'],
  warn: ['fatal', 'error', 'warn'],
  info: ['fatal', 'error', 'warn', 'log'],
  debug: ['fatal', 'error', 'warn', 'log', 'debug'],
  trace: ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'],
};

export async function createApiApplication(
  config: ApiServiceConfig,
  enableShutdownHooks = true,
  identityOverrides: IdentityModuleOverrides = {},
  profileOverrides: ProfileModuleOverrides = {},
  catalogOverrides: GameCatalogModuleOverrides = {},
  playerIdentityOverrides: PlayerIdentityModuleOverrides = {},
  matchmakingOverrides: MatchmakingModuleOverrides = {},
  matchesOverrides: MatchesModuleOverrides = {},
  walletOverrides: WalletModuleOverrides = {},
  matchFinanceOverrides: MatchFinanceModuleOverrides = {},
  ratingsOverrides: RatingsModuleOverrides = {},
  notificationsOverrides: NotificationsModuleOverrides = {},
  adminOperationsOverrides: AdminOperationsModuleOverrides = {},
): Promise<INestApplication> {
  const logger =
    config.runtime.logLevel === 'silent' ? false : nestLogLevels[config.runtime.logLevel];
  const application = await NestFactory.create<NestExpressApplication>(
    AppModule.register(
      config,
      identityOverrides,
      profileOverrides,
      catalogOverrides,
      playerIdentityOverrides,
      matchmakingOverrides,
      matchesOverrides,
      walletOverrides,
      matchFinanceOverrides,
      ratingsOverrides,
      notificationsOverrides,
      adminOperationsOverrides,
    ),
    {
      logger,
      bodyParser: false,
      abortOnError: false,
    },
  );
  application.useBodyParser('json', { limit: config.identityHttp.maxRequestBodyBytes });
  const expressInstance = application.getHttpAdapter().getInstance() as unknown as {
    disable(setting: string): void;
    set(setting: string, value: unknown): void;
  };
  expressInstance.disable('x-powered-by');
  const proxy = config.hardening.proxy;
  expressInstance.set(
    'trust proxy',
    proxy.mode === 'none'
      ? false
      : proxy.mode === 'loopback'
        ? 'loopback'
        : proxy.mode === 'private'
          ? 'linklocal, uniquelocal'
          : (proxy.hops ?? 1),
  );
  application.use(
    (
      request: {
        headers: Record<string, string | string[] | undefined>;
        requestId?: string;
        correlationId?: string;
        method?: string;
        route?: { path?: string };
      },
      response: { setHeader(name: string, value: string): void },
      next: () => void,
    ) => {
      const supplied = request.headers['x-request-id'];
      const correlation = request.headers['x-correlation-id'];
      request.requestId = validOpaqueId(supplied) ? supplied : randomUUID();
      request.correlationId = validOpaqueId(correlation) ? correlation : request.requestId;
      response.setHeader('X-Request-Id', request.requestId);
      response.setHeader('X-Correlation-Id', request.correlationId);
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Pragma', 'no-cache');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      response.setHeader('X-Frame-Options', 'DENY');
      response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      );
      response.setHeader('X-XSS-Protection', '0');
      if (config.hardening.security.hsts)
        response.setHeader(
          'Strict-Transport-Security',
          `max-age=31536000${config.hardening.security.hstsIncludeSubDomains ? '; includeSubDomains' : ''}`,
        );
      requestContext.run(
        {
          requestId: request.requestId,
          correlationId: request.correlationId,
          ...(request.method === undefined ? {} : { method: request.method }),
          ...(request.route?.path === undefined ? {} : { route: request.route.path }),
        },
        next,
      );
    },
  );
  application.setGlobalPrefix(config.api.prefix);

  if (config.api.cors.enabled) {
    const allowlist = new Set(
      config.hardening.cors.allowedOrigins.length > 0
        ? config.hardening.cors.allowedOrigins
        : config.api.cors.allowedOrigins,
    );
    application.enableCors({
      credentials: true,
      origin(origin, callback) {
        if (origin === undefined && config.hardening.cors.allowNoOrigin) {
          callback(null, true);
          return;
        }
        if (origin !== undefined && allowlist.has(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('ORIGIN_NOT_ALLOWED'), false);
      },
    });
  }

  if (enableShutdownHooks) {
    application.enableShutdownHooks();
  }

  const server = application.getHttpServer() as {
    headersTimeout?: number;
    requestTimeout?: number;
    keepAliveTimeout?: number;
  };
  server.headersTimeout = config.hardening.http.headersTimeoutMs;
  server.requestTimeout = config.hardening.http.requestTimeoutMs;
  server.keepAliveTimeout = config.hardening.http.keepAliveTimeoutMs;

  return application;
}
