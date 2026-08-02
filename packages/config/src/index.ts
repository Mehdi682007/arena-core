import { isIP } from 'node:net';
import { readFileSync } from 'node:fs';
import { inspect } from 'node:util';
import { satisfies, valid } from 'semver';
import { z } from 'zod';
import { createProductionHardeningConfig } from './production-hardening';
export * from './production-hardening';

export type Environment = 'development' | 'test' | 'staging' | 'production';
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
export type Locale = 'fa' | 'en';
export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export interface RuntimeConfig {
  readonly environment: Environment;
  readonly version: string;
  readonly logLevel: LogLevel;
  readonly nodeVersion: string;
}

export interface NetworkConfig {
  readonly host: string;
}

export interface PublicWebConfig {
  readonly appName: string;
  readonly defaultLocale: Locale;
}

export interface AdminOriginConfig {
  readonly origin: string;
  readonly hostname: string;
}

export interface DisabledDatabaseConfig {
  readonly enabled: false;
  readonly logQueries: false;
}

export interface EnabledDatabaseConfig {
  readonly enabled: true;
  readonly url: string;
  readonly directUrl: string;
  readonly logQueries: boolean;
  readonly connectTimeoutSeconds: number;
}

export type DatabaseConfig = DisabledDatabaseConfig | EnabledDatabaseConfig;

export class SecretValue {
  readonly #value: string;

  public constructor(value: string) {
    this.#value = value;
    Object.freeze(this);
  }

  public reveal(): string {
    return this.#value;
  }

  public toJSON(): string {
    return '[REDACTED]';
  }

  public toString(): string {
    return 'SecretValue([REDACTED])';
  }

  public [inspect.custom](): string {
    return 'SecretValue([REDACTED])';
  }
}

export interface AuthenticationConfig {
  readonly password: Readonly<{
    minLength: number;
    maxLength: number;
    algorithm: 'argon2id';
    memoryKiB: number;
    iterations: number;
    parallelism: number;
  }>;
  readonly session: Readonly<{
    tokenBytes: number;
    ttlSeconds: number;
    idleTimeoutSeconds: number;
    touchIntervalSeconds: number;
  }>;
  readonly emailVerification: Readonly<{ tokenBytes: number; ttlSeconds: number }>;
  readonly passwordReset: Readonly<{ tokenBytes: number; ttlSeconds: number }>;
  readonly lockout: Readonly<{ maxFailedAttempts: number; seconds: number }>;
  readonly tokenHashKey: SecretValue;
  readonly ipHashKey: SecretValue;
}

export interface IdentityHttpConfig {
  readonly cookie: Readonly<{
    name: string;
    secure: boolean;
    sameSite: 'lax' | 'strict';
    path: string;
    domain?: string;
    maxAgeSeconds: number;
  }>;
  readonly allowedOrigins: readonly string[];
  readonly requireOrigin: boolean;
  readonly maxRequestBodyBytes: number;
  readonly rateLimit: Readonly<{
    login: Readonly<{ maximum: number; windowSeconds: number }>;
    register: Readonly<{ maximum: number; windowSeconds: number }>;
    token: Readonly<{ maximum: number; windowSeconds: number }>;
  }>;
}

export interface EmailConfig {
  readonly enabled: boolean;
  readonly transport: 'smtp';
  readonly smtp: Readonly<{
    host: string;
    port: number;
    secure: boolean;
    username?: string;
    password?: SecretValue;
    connectionTimeoutMs: number;
    greetingTimeoutMs: number;
    socketTimeoutMs: number;
  }>;
  readonly from: Readonly<{ address: string; name: string }>;
  readonly replyTo?: Readonly<{ address: string }>;
}

export interface IdentityEmailConfig {
  readonly publicBaseUrl: string;
  readonly defaultLocale: Locale;
  readonly verificationPath: string;
  readonly passwordResetPath: string;
  readonly deliveryRequired: boolean;
  readonly appName: string;
}

export interface MatchmakingConfig {
  readonly requestTtlSeconds: number;
  readonly proposalTtlSeconds: number;
  readonly maxActiveRequestsPerUser: 1;
  readonly maxCandidatesPerEvaluation: number;
}

export interface MatchesConfig {
  readonly readyTtlSeconds: number;
  readonly entryReservationTtlSeconds: number;
  readonly settlementDelaySeconds: number;
  readonly resultSubmissionTtlSeconds: number;
  readonly resultConflictResolutionTtlSeconds: number;
  readonly evidenceSubmissionTtlSeconds: number;
  readonly disputeOpenTtlSeconds: number;
  readonly disputeResponseTtlSeconds: number;
  readonly disputeReviewTtlSeconds: number;
}

export interface RatingConfig {
  readonly initialValue: number;
  readonly provisionalMatchCount: number;
  readonly provisionalKFactor: number;
  readonly establishedKFactor: number;
  readonly minimumValue: number;
  readonly maximumValue: number;
  readonly matchDelaySeconds: number;
  readonly leaderboardMinimumMatchesPlayed: number;
}
export interface NotificationConfig {
  readonly deliveryMaxAttempts: number;
  readonly retryBaseSeconds: number;
  readonly retryMaxSeconds: number;
  readonly claimLeaseSeconds: number;
}

export interface WebServiceConfig {
  readonly runtime: RuntimeConfig;
  readonly network: NetworkConfig;
  readonly web: Readonly<{ port: number }>;
  readonly public: PublicWebConfig;
  readonly server: Readonly<{ apiBaseUrl: string }>;
  readonly admin: AdminOriginConfig;
  readonly warnings: readonly string[];
}

export interface ApiServiceConfig {
  readonly runtime: RuntimeConfig;
  readonly network: NetworkConfig;
  readonly database: DatabaseConfig;
  readonly authentication: AuthenticationConfig;
  readonly identityHttp: IdentityHttpConfig;
  readonly admin: AdminOriginConfig;
  readonly email: EmailConfig;
  readonly identityEmail: IdentityEmailConfig;
  readonly matchmaking: MatchmakingConfig;
  readonly matches: MatchesConfig;
  readonly rating: RatingConfig;
  readonly notifications: NotificationConfig;
  readonly hardening: import('./production-hardening').ProductionHardeningConfig;
  readonly api: Readonly<{
    port: number;
    prefix: string;
    cors: Readonly<{ enabled: boolean; allowedOrigins: readonly string[] }>;
  }>;
  readonly warnings: readonly string[];
}

export interface WorkerServiceConfig {
  readonly runtime: RuntimeConfig;
  readonly database: DatabaseConfig;
  readonly hardening: import('./production-hardening').ProductionHardeningConfig;
  readonly worker: Readonly<{ shutdownTimeoutMs: number }>;
  readonly warnings: readonly string[];
}

export interface ConfigOptions {
  readonly packageVersion: string;
  readonly actualNodeVersion?: string;
  readonly engineRange?: string;
  readonly pinnedNodeVersion?: string;
}

export class ConfigurationError extends Error {
  public readonly variables: readonly string[];

  public constructor(issues: readonly { variable: string; message: string }[]) {
    super(
      `Configuration validation failed:\n${issues.map((issue) => `- ${issue.variable} ${issue.message}`).join('\n')}`,
    );
    this.name = 'ConfigurationError';
    this.variables = Object.freeze([...new Set(issues.map((issue) => issue.variable))]);
  }
}

const environmentSchema = z.enum(['development', 'test', 'staging', 'production']);
const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);
const localeSchema = z.enum(['fa', 'en']);
const versionSchema = z
  .string()
  .trim()
  .min(1, 'must not be empty')
  .max(64, 'must be at most 64 characters')
  .regex(/^[A-Za-z0-9._+-]+$/, 'contains unsupported characters');
const portSchema = z
  .string()
  .regex(/^[0-9]+$/, 'must be an integer between 1 and 65535')
  .transform(Number)
  .pipe(z.number().int().min(1).max(65_535));
const timeoutSchema = z
  .string()
  .regex(/^[0-9]+$/, 'must be an integer between 1000 and 120000')
  .transform(Number)
  .pipe(z.number().int().min(1_000).max(120_000));
const databaseConnectTimeoutSchema = z
  .string()
  .regex(/^[0-9]+$/, 'must be an integer between 1 and 60')
  .transform(Number)
  .pipe(z.number().int().min(1).max(60));
const booleanSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

function parseBoundedInteger(
  source: EnvironmentSource,
  variable: string,
  fallback: number,
  minimum: number,
  maximum: number,
  issues: { variable: string; message: string }[],
): number {
  const schema = z
    .string()
    .regex(/^[0-9]+$/, `must be an integer between ${String(minimum)} and ${String(maximum)}`)
    .transform(Number)
    .pipe(z.number().int().min(minimum).max(maximum));
  return (
    parseValue(variable, schema, source[variable]?.trim() || String(fallback), issues) ?? fallback
  );
}

function parseValue<T>(
  variable: string,
  schema: z.ZodType<T>,
  value: unknown,
  issues: { variable: string; message: string }[],
): T | undefined {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  issues.push({ variable, message: result.error.issues[0]?.message ?? 'is invalid' });
  return undefined;
}

function requiredValue(
  source: EnvironmentSource,
  variable: string,
  fallback: string,
  strict: boolean,
  issues: { variable: string; message: string }[],
): string {
  const value = source[variable];
  if (value !== undefined && value.trim() !== '') return value.trim();
  if (strict) issues.push({ variable, message: 'must be set explicitly in staging/production' });
  return fallback;
}

function validateHost(host: string): boolean {
  if (isIP(host) !== 0) return true;
  if (host === 'localhost') return true;
  return (
    host.length <= 253 &&
    host.split('.').every((label) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))
  );
}

function parseOrigins(
  value: string | undefined,
  environment: Environment,
  issues: { variable: string; message: string }[],
  variable = 'CORS_ALLOWED_ORIGINS',
): readonly string[] {
  const unique = new Set<string>();
  for (const entry of (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)) {
    if (entry === '*') {
      if (environment === 'production' || environment === 'staging') {
        issues.push({
          variable,
          message: 'must not contain wildcard in staging/production',
        });
      } else {
        unique.add(entry);
      }
      continue;
    }
    try {
      const url = new URL(entry);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      ) {
        throw new Error('invalid origin');
      }
      unique.add(url.origin);
    } catch {
      issues.push({
        variable,
        message: 'must contain valid HTTP(S) origins without paths or credentials',
      });
    }
  }
  return Object.freeze([...unique]);
}

function parseAdminOrigin(
  source: EnvironmentSource,
  environment: Environment,
  issues: { variable: string; message: string }[],
): AdminOriginConfig {
  const required = environment === 'production';
  const rawOrigin = source.ADMIN_ORIGIN?.trim() ?? '';
  const rawDomain = source.ADMIN_DOMAIN?.trim().toLowerCase() ?? '';
  if (required && !rawOrigin)
    issues.push({ variable: 'ADMIN_ORIGIN', message: 'must be set explicitly in production' });
  if (required && !rawDomain)
    issues.push({ variable: 'ADMIN_DOMAIN', message: 'must be set explicitly in production' });
  if (rawDomain && (!validateHost(rawDomain) || isIP(rawDomain) !== 0 || rawDomain.includes('*'))) {
    issues.push({
      variable: 'ADMIN_DOMAIN',
      message: 'must be a valid DNS hostname without wildcards',
    });
  }
  let origin = rawOrigin || 'http://admin.localhost';
  let hostname = rawDomain || 'admin.localhost';
  try {
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.hostname.includes('*')
    )
      throw new Error('invalid');
    if (required && url.protocol !== 'https:')
      issues.push({ variable: 'ADMIN_ORIGIN', message: 'must use HTTPS in production' });
    origin = url.origin;
    hostname = rawDomain || url.hostname.toLowerCase();
    if (rawDomain && url.hostname.toLowerCase() !== rawDomain)
      issues.push({ variable: 'ADMIN_DOMAIN', message: 'must match the ADMIN_ORIGIN hostname' });
    const publicOrigin = source.APP_BASE_URL?.trim();
    if (required && publicOrigin) {
      try {
        if (new URL(publicOrigin).origin === origin)
          issues.push({
            variable: 'ADMIN_ORIGIN',
            message: 'must differ from APP_BASE_URL in production',
          });
      } catch {
        /* APP_BASE_URL validation reports its own issue. */
      }
    }
  } catch {
    issues.push({
      variable: 'ADMIN_ORIGIN',
      message:
        'must be an exact HTTP(S) origin without credentials, path, query, fragment, or wildcard',
    });
  }
  return Object.freeze({ origin, hostname });
}

function parseRuntime(
  source: EnvironmentSource,
  options: ConfigOptions,
  issues: { variable: string; message: string }[],
): {
  runtime: RuntimeConfig;
  network: NetworkConfig;
  strict: boolean;
  warnings: readonly string[];
} {
  const environment =
    parseValue('NODE_ENV', environmentSchema, source.NODE_ENV?.trim() || 'development', issues) ??
    'development';
  const strict = environment === 'staging' || environment === 'production';
  const version =
    parseValue(
      'APP_VERSION',
      versionSchema,
      source.APP_VERSION?.trim() || options.packageVersion,
      issues,
    ) ?? options.packageVersion;
  const logLevel =
    parseValue(
      'LOG_LEVEL',
      logLevelSchema,
      requiredValue(source, 'LOG_LEVEL', 'info', strict, issues),
      issues,
    ) ?? 'info';
  const host = requiredValue(source, 'HOST', '127.0.0.1', strict, issues);
  if (!validateHost(host))
    issues.push({
      variable: 'HOST',
      message: 'must be a hostname or IP without protocol, port, or path',
    });

  const nodeVersion = (options.actualNodeVersion ?? process.versions.node).replace(/^v/, '');
  const engineRange = options.engineRange ?? '>=24.14.0 <25';
  if (valid(nodeVersion) === null || !satisfies(nodeVersion, engineRange)) {
    issues.push({ variable: 'NODE_RUNTIME', message: `must satisfy engine range ${engineRange}` });
  }
  const pinned = (options.pinnedNodeVersion ?? '24.18.0').replace(/^v/, '');
  const warnings =
    environment === 'development' && nodeVersion !== pinned
      ? Object.freeze([
          `Node runtime ${nodeVersion} differs from recommended ${pinned} but satisfies ${engineRange}.`,
        ])
      : Object.freeze([]);

  return {
    runtime: Object.freeze({ environment, version, logLevel, nodeVersion }),
    network: Object.freeze({ host }),
    strict,
    warnings,
  };
}

function isPostgreSqlUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
      url.hostname.length > 0 &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}

function parseDatabase(
  source: EnvironmentSource,
  strict: boolean,
  issues: { variable: string; message: string }[],
): DatabaseConfig {
  const enabled =
    parseValue(
      'DATABASE_ENABLED',
      booleanSchema,
      requiredValue(source, 'DATABASE_ENABLED', 'false', strict, issues),
      issues,
    ) ?? false;
  const logQueries =
    parseValue(
      'DATABASE_LOG_QUERIES',
      booleanSchema,
      source.DATABASE_LOG_QUERIES?.trim() || 'false',
      issues,
    ) ?? false;
  const connectTimeoutSeconds =
    parseValue(
      'DATABASE_CONNECT_TIMEOUT_SECONDS',
      databaseConnectTimeoutSchema,
      source.DATABASE_CONNECT_TIMEOUT_SECONDS?.trim() || '5',
      issues,
    ) ?? 5;

  if (!enabled) return Object.freeze({ enabled: false, logQueries: false });

  const url = source.DATABASE_URL?.trim();
  const directUrl = source.DATABASE_DIRECT_URL?.trim();
  if (!url)
    issues.push({ variable: 'DATABASE_URL', message: 'must be set when database is enabled' });
  else if (!isPostgreSqlUrl(url))
    issues.push({ variable: 'DATABASE_URL', message: 'must be a valid PostgreSQL URL' });
  if (!directUrl)
    issues.push({
      variable: 'DATABASE_DIRECT_URL',
      message: 'must be set when database is enabled',
    });
  else if (!isPostgreSqlUrl(directUrl))
    issues.push({ variable: 'DATABASE_DIRECT_URL', message: 'must be a valid PostgreSQL URL' });

  return Object.freeze({
    enabled: true,
    url: url ?? '',
    directUrl: directUrl ?? '',
    logQueries,
    connectTimeoutSeconds,
  });
}

const developmentTokenKey = 'development-only-token-hash-key-32-bytes-minimum';
const developmentIpKey = 'development-only-ip-hash-key-32-bytes-minimum';

function parseAuthentication(
  source: EnvironmentSource,
  strict: boolean,
  issues: { variable: string; message: string }[],
): AuthenticationConfig {
  const minLength = parseBoundedInteger(source, 'PASSWORD_MIN_LENGTH', 12, 8, 128, issues);
  const maxLength = parseBoundedInteger(source, 'PASSWORD_MAX_LENGTH', 128, 12, 1024, issues);
  if (minLength > maxLength) {
    issues.push({
      variable: 'PASSWORD_MIN_LENGTH',
      message: 'must not exceed PASSWORD_MAX_LENGTH',
    });
  }
  const algorithm = source.PASSWORD_HASH_ALGORITHM?.trim() || 'argon2id';
  if (algorithm !== 'argon2id') {
    issues.push({ variable: 'PASSWORD_HASH_ALGORITHM', message: 'must be argon2id' });
  }
  const memoryKiB = parseBoundedInteger(
    source,
    'ARGON2_MEMORY_KIB',
    19_456,
    19_456,
    1_048_576,
    issues,
  );
  const iterations = parseBoundedInteger(source, 'ARGON2_ITERATIONS', 2, 2, 20, issues);
  const parallelism = parseBoundedInteger(source, 'ARGON2_PARALLELISM', 1, 1, 16, issues);
  const sessionTokenBytes = parseBoundedInteger(source, 'SESSION_TOKEN_BYTES', 32, 32, 128, issues);
  const sessionTtl = parseBoundedInteger(
    source,
    'SESSION_TTL_SECONDS',
    2_592_000,
    300,
    31_536_000,
    issues,
  );
  const idleTimeout = parseBoundedInteger(
    source,
    'SESSION_IDLE_TIMEOUT_SECONDS',
    604_800,
    60,
    31_536_000,
    issues,
  );
  if (idleTimeout > sessionTtl) {
    issues.push({
      variable: 'SESSION_IDLE_TIMEOUT_SECONDS',
      message: 'must not exceed SESSION_TTL_SECONDS',
    });
  }
  const touchInterval = parseBoundedInteger(
    source,
    'SESSION_TOUCH_INTERVAL_SECONDS',
    300,
    30,
    86_400,
    issues,
  );
  const verificationTokenBytes = parseBoundedInteger(
    source,
    'EMAIL_VERIFICATION_TOKEN_BYTES',
    32,
    32,
    128,
    issues,
  );
  const verificationTtl = parseBoundedInteger(
    source,
    'EMAIL_VERIFICATION_TTL_SECONDS',
    86_400,
    300,
    604_800,
    issues,
  );
  const resetTokenBytes = parseBoundedInteger(
    source,
    'PASSWORD_RESET_TOKEN_BYTES',
    32,
    32,
    128,
    issues,
  );
  const resetTtl = parseBoundedInteger(
    source,
    'PASSWORD_RESET_TTL_SECONDS',
    3_600,
    300,
    86_400,
    issues,
  );
  const maxFailedAttempts = parseBoundedInteger(
    source,
    'AUTH_MAX_FAILED_ATTEMPTS',
    5,
    1,
    100,
    issues,
  );
  const lockoutSeconds = parseBoundedInteger(
    source,
    'AUTH_LOCKOUT_SECONDS',
    900,
    30,
    86_400,
    issues,
  );
  const tokenKey = requiredValue(
    source,
    'AUTH_TOKEN_HASH_KEY',
    developmentTokenKey,
    strict,
    issues,
  );
  const ipKey = requiredValue(source, 'AUTH_IP_HASH_KEY', developmentIpKey, strict, issues);
  for (const [variable, value] of [
    ['AUTH_TOKEN_HASH_KEY', tokenKey],
    ['AUTH_IP_HASH_KEY', ipKey],
  ] as const) {
    if (value.length < 32)
      issues.push({ variable, message: 'must contain at least 32 characters' });
    if (strict && value.startsWith('development-only-')) {
      issues.push({ variable, message: 'must not use a development placeholder' });
    }
  }
  if (tokenKey === ipKey) {
    issues.push({ variable: 'AUTH_IP_HASH_KEY', message: 'must differ from AUTH_TOKEN_HASH_KEY' });
  }

  return Object.freeze({
    password: Object.freeze({
      minLength,
      maxLength,
      algorithm: 'argon2id' as const,
      memoryKiB,
      iterations,
      parallelism,
    }),
    session: Object.freeze({
      tokenBytes: sessionTokenBytes,
      ttlSeconds: sessionTtl,
      idleTimeoutSeconds: idleTimeout,
      touchIntervalSeconds: touchInterval,
    }),
    emailVerification: Object.freeze({
      tokenBytes: verificationTokenBytes,
      ttlSeconds: verificationTtl,
    }),
    passwordReset: Object.freeze({ tokenBytes: resetTokenBytes, ttlSeconds: resetTtl }),
    lockout: Object.freeze({ maxFailedAttempts, seconds: lockoutSeconds }),
    tokenHashKey: new SecretValue(tokenKey),
    ipHashKey: new SecretValue(ipKey),
  });
}

function parseIdentityHttp(
  source: EnvironmentSource,
  environment: Environment,
  sessionTtlSeconds: number,
  issues: { variable: string; message: string }[],
): IdentityHttpConfig {
  const strict = environment === 'staging' || environment === 'production';
  const name = source.SESSION_COOKIE_NAME?.trim() || 'arena_session';
  if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]{1,64}$/.test(name)) {
    issues.push({ variable: 'SESSION_COOKIE_NAME', message: 'must be a valid cookie name' });
  }
  const secure =
    parseValue(
      'SESSION_COOKIE_SECURE',
      booleanSchema,
      source.SESSION_COOKIE_SECURE?.trim() || (strict ? 'true' : 'false'),
      issues,
    ) ?? strict;
  if (strict && !secure) {
    issues.push({
      variable: 'SESSION_COOKIE_SECURE',
      message: 'must be true in staging and production',
    });
  }
  const sameSiteValue = source.SESSION_COOKIE_SAME_SITE?.trim().toLowerCase() || 'lax';
  if (!['lax', 'strict'].includes(sameSiteValue)) {
    issues.push({ variable: 'SESSION_COOKIE_SAME_SITE', message: 'must be lax or strict' });
  }
  const path = source.SESSION_COOKIE_PATH?.trim() || '/';
  if (!path.startsWith('/') || /[;\r\n]/.test(path)) {
    issues.push({ variable: 'SESSION_COOKIE_PATH', message: 'must be an absolute cookie path' });
  }
  const domain = source.SESSION_COOKIE_DOMAIN?.trim();
  if (
    domain !== undefined &&
    (!/^(?:\.[A-Za-z0-9-]+|[A-Za-z0-9-]+)(?:\.[A-Za-z0-9-]+)+$/.test(domain) ||
      domain.includes('..'))
  ) {
    issues.push({ variable: 'SESSION_COOKIE_DOMAIN', message: 'must be a valid DNS domain' });
  }
  if (name.startsWith('__Host-') && (!secure || path !== '/' || domain !== undefined)) {
    issues.push({
      variable: 'SESSION_COOKIE_NAME',
      message: '__Host- cookies require Secure, Path=/, and no Domain',
    });
  }
  const maxAgeSeconds = parseBoundedInteger(
    source,
    'SESSION_COOKIE_MAX_AGE_SECONDS',
    sessionTtlSeconds,
    300,
    sessionTtlSeconds,
    issues,
  );
  const allowedOrigins = parseOrigins(
    source.AUTH_ALLOWED_ORIGINS ?? source.CORS_ALLOWED_ORIGINS,
    environment,
    issues,
    'AUTH_ALLOWED_ORIGINS',
  );
  const requireOrigin =
    parseValue(
      'AUTH_REQUIRE_ORIGIN',
      booleanSchema,
      source.AUTH_REQUIRE_ORIGIN?.trim() || (strict ? 'true' : 'false'),
      issues,
    ) ?? strict;
  if (strict && allowedOrigins.length === 0) {
    issues.push({
      variable: 'AUTH_ALLOWED_ORIGINS',
      message: 'must contain at least one exact origin in staging/production',
    });
  }
  const maxRequestBodyBytes = parseBoundedInteger(
    source,
    'AUTH_MAX_REQUEST_BODY_BYTES',
    16_384,
    1_024,
    1_048_576,
    issues,
  );
  const rate = (prefix: string, maximum: number, windowSeconds: number) =>
    Object.freeze({
      maximum: parseBoundedInteger(source, `${prefix}_MAX`, maximum, 1, 10_000, issues),
      windowSeconds: parseBoundedInteger(
        source,
        `${prefix}_WINDOW_SECONDS`,
        windowSeconds,
        1,
        86_400,
        issues,
      ),
    });
  return Object.freeze({
    cookie: Object.freeze({
      name,
      secure,
      sameSite: sameSiteValue === 'strict' ? 'strict' : 'lax',
      path,
      ...(domain === undefined ? {} : { domain }),
      maxAgeSeconds,
    }),
    allowedOrigins,
    requireOrigin,
    maxRequestBodyBytes,
    rateLimit: Object.freeze({
      login: rate('AUTH_RATE_LIMIT_LOGIN', 5, 60),
      register: rate('AUTH_RATE_LIMIT_REGISTER', 5, 300),
      token: rate('AUTH_RATE_LIMIT_TOKEN', 10, 300),
    }),
  });
}

function isBasicEmailAddress(value: string): boolean {
  return (
    value.length <= 320 &&
    /^[^\s@]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value) &&
    !/[\r\n]/.test(value)
  );
}

function parseEmailConfig(
  source: EnvironmentSource,
  environment: Environment,
  issues: { variable: string; message: string }[],
): { email: EmailConfig; identityEmail: IdentityEmailConfig } {
  const strict = environment === 'staging' || environment === 'production';
  const enabled =
    parseValue('SMTP_ENABLED', booleanSchema, source.SMTP_ENABLED?.trim() || 'false', issues) ??
    false;
  const host = source.SMTP_HOST?.trim() || '127.0.0.1';
  if (host.length === 0 || host.length > 253 || /[:/\\\s\r\n]/.test(host) || !validateHost(host)) {
    issues.push({ variable: 'SMTP_HOST', message: 'must be a hostname or IP without a port' });
  }
  const port = parseBoundedInteger(source, 'SMTP_PORT', 1025, 1, 65_535, issues);
  const secure =
    parseValue('SMTP_SECURE', booleanSchema, source.SMTP_SECURE?.trim() || 'false', issues) ??
    false;
  const username = source.SMTP_USERNAME?.trim() || undefined;
  const passwordFile = source.SMTP_PASSWORD_FILE?.trim();
  if (source.SMTP_PASSWORD?.trim() && passwordFile) {
    issues.push({
      variable: 'SMTP_PASSWORD_FILE',
      message: 'must not be combined with SMTP_PASSWORD',
    });
  }
  let filePassword: string | undefined;
  if (passwordFile && enabled) {
    if (!passwordFile.startsWith('/') || /[\r\n]/.test(passwordFile)) {
      issues.push({ variable: 'SMTP_PASSWORD_FILE', message: 'must be an absolute path' });
    } else {
      try {
        filePassword = readFileSync(passwordFile, 'utf8').trim();
      } catch {
        issues.push({
          variable: 'SMTP_PASSWORD_FILE',
          message: 'must reference a readable secret file',
        });
      }
    }
  }
  const rawPassword = source.SMTP_PASSWORD?.trim() || filePassword;
  if ((username === undefined) !== (rawPassword === undefined)) {
    issues.push({
      variable: username === undefined ? 'SMTP_USERNAME' : 'SMTP_PASSWORD',
      message: 'must be provided together with the other SMTP credential',
    });
  }
  const fromAddress = source.SMTP_FROM_ADDRESS?.trim() || 'no-reply@arena-core.local';
  if (!isBasicEmailAddress(fromAddress)) {
    issues.push({ variable: 'SMTP_FROM_ADDRESS', message: 'must be a valid email address' });
  }
  const fromName = source.SMTP_FROM_NAME?.trim() || 'Arena Core';
  if (fromName.length === 0 || fromName.length > 120 || /[\r\n]/.test(fromName)) {
    issues.push({
      variable: 'SMTP_FROM_NAME',
      message: 'must be 1-120 characters without newline',
    });
  }
  const replyToAddress = source.SMTP_REPLY_TO_ADDRESS?.trim() || undefined;
  if (replyToAddress !== undefined && !isBasicEmailAddress(replyToAddress)) {
    issues.push({ variable: 'SMTP_REPLY_TO_ADDRESS', message: 'must be a valid email address' });
  }
  const connectionTimeoutMs = parseBoundedInteger(
    source,
    'SMTP_CONNECTION_TIMEOUT_MS',
    5_000,
    100,
    120_000,
    issues,
  );
  const greetingTimeoutMs = parseBoundedInteger(
    source,
    'SMTP_GREETING_TIMEOUT_MS',
    5_000,
    100,
    120_000,
    issues,
  );
  const socketTimeoutMs = parseBoundedInteger(
    source,
    'SMTP_SOCKET_TIMEOUT_MS',
    10_000,
    100,
    300_000,
    issues,
  );
  const deliveryRequired =
    parseValue(
      'IDENTITY_EMAIL_DELIVERY_REQUIRED',
      booleanSchema,
      source.IDENTITY_EMAIL_DELIVERY_REQUIRED?.trim() || 'false',
      issues,
    ) ?? false;
  if (deliveryRequired && !enabled) {
    issues.push({
      variable: 'SMTP_ENABLED',
      message: 'must be true when identity email delivery is required',
    });
  }
  const rawBaseUrl = source.IDENTITY_PUBLIC_BASE_URL?.trim() || 'http://localhost:3000';
  let publicBaseUrl = rawBaseUrl;
  try {
    const url = new URL(rawBaseUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error('invalid');
    }
    if (strict && url.protocol !== 'https:') {
      issues.push({
        variable: 'IDENTITY_PUBLIC_BASE_URL',
        message: 'must use HTTPS in staging/production',
      });
    }
    publicBaseUrl = url.toString().replace(/\/$/, '');
  } catch {
    issues.push({
      variable: 'IDENTITY_PUBLIC_BASE_URL',
      message: 'must be an absolute HTTP(S) URL without query, fragment, or credentials',
    });
  }
  const path = (variable: string, fallback: string): string => {
    const value = source[variable]?.trim() || fallback;
    if (!value.startsWith('/') || value.startsWith('//') || /[?#\r\n]/.test(value)) {
      issues.push({ variable, message: 'must be an absolute URL path without query or fragment' });
    }
    return value;
  };
  const defaultLocale =
    parseValue(
      'IDENTITY_EMAIL_DEFAULT_LOCALE',
      localeSchema,
      source.IDENTITY_EMAIL_DEFAULT_LOCALE?.trim() || 'fa',
      issues,
    ) ?? 'fa';
  const appName = source.IDENTITY_EMAIL_APP_NAME?.trim() || 'Arena Core';
  if (appName.length === 0 || appName.length > 80 || /[\r\n]/.test(appName)) {
    issues.push({
      variable: 'IDENTITY_EMAIL_APP_NAME',
      message: 'must be 1-80 characters without newline',
    });
  }
  return {
    email: Object.freeze({
      enabled,
      transport: 'smtp',
      smtp: Object.freeze({
        host,
        port,
        secure,
        ...(username === undefined ? {} : { username }),
        ...(rawPassword === undefined ? {} : { password: new SecretValue(rawPassword) }),
        connectionTimeoutMs,
        greetingTimeoutMs,
        socketTimeoutMs,
      }),
      from: Object.freeze({ address: fromAddress, name: fromName }),
      ...(replyToAddress === undefined
        ? {}
        : { replyTo: Object.freeze({ address: replyToAddress }) }),
    }),
    identityEmail: Object.freeze({
      publicBaseUrl,
      defaultLocale,
      verificationPath: path('IDENTITY_EMAIL_VERIFICATION_PATH', '/verify-email'),
      passwordResetPath: path('IDENTITY_PASSWORD_RESET_PATH', '/reset-password'),
      deliveryRequired,
      appName,
    }),
  };
}

function finish<T>(
  issues: readonly { variable: string; message: string }[],
  config: T,
): Readonly<T> {
  if (issues.length > 0) throw new ConfigurationError(issues);
  return Object.freeze(config);
}

export function createWebConfig(
  source: EnvironmentSource,
  options: ConfigOptions,
): WebServiceConfig {
  const issues: { variable: string; message: string }[] = [];
  const base = parseRuntime(source, options, issues);
  const admin = parseAdminOrigin(source, base.runtime.environment, issues);
  const port =
    parseValue(
      'WEB_PORT',
      portSchema,
      requiredValue(source, 'WEB_PORT', '3000', base.strict, issues),
      issues,
    ) ?? 3000;
  const appName = requiredValue(source, 'NEXT_PUBLIC_APP_NAME', 'Arena Core', base.strict, issues);
  if (appName.length > 80)
    issues.push({ variable: 'NEXT_PUBLIC_APP_NAME', message: 'must be at most 80 characters' });
  const defaultLocale =
    parseValue(
      'NEXT_PUBLIC_DEFAULT_LOCALE',
      localeSchema,
      requiredValue(source, 'NEXT_PUBLIC_DEFAULT_LOCALE', 'fa', base.strict, issues),
      issues,
    ) ?? 'fa';
  const rawApiBaseUrl = requiredValue(
    source,
    'API_BASE_URL',
    'http://localhost:3001/api/v1',
    base.strict,
    issues,
  );
  let apiBaseUrl = rawApiBaseUrl;
  try {
    const url = new URL(rawApiBaseUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error('invalid');
    }
    if (base.strict && url.protocol !== 'https:') {
      issues.push({ variable: 'API_BASE_URL', message: 'must use HTTPS in staging/production' });
    }
    apiBaseUrl = url.toString().replace(/\/$/, '');
  } catch {
    issues.push({
      variable: 'API_BASE_URL',
      message: 'must be an absolute HTTP(S) URL without query, fragment, or credentials',
    });
  }

  return finish(issues, {
    runtime: base.runtime,
    network: base.network,
    web: Object.freeze({ port }),
    public: Object.freeze({ appName, defaultLocale }),
    server: Object.freeze({ apiBaseUrl }),
    admin,
    warnings: base.warnings,
  });
}

export function createApiConfig(
  source: EnvironmentSource,
  options: ConfigOptions,
): ApiServiceConfig {
  const issues: { variable: string; message: string }[] = [];
  const base = parseRuntime(source, options, issues);
  const admin = parseAdminOrigin(source, base.runtime.environment, issues);
  const hardening = createProductionHardeningConfig(source);
  const port =
    parseValue(
      'API_PORT',
      portSchema,
      requiredValue(source, 'API_PORT', '3001', base.strict, issues),
      issues,
    ) ?? 3001;
  const rawPrefix = requiredValue(source, 'API_PREFIX', '/api/v1', base.strict, issues);
  const prefix = `/${rawPrefix.replace(/^\/+|\/+$/g, '')}`;
  if (prefix === '/' || /[?#]/.test(prefix)) {
    issues.push({
      variable: 'API_PREFIX',
      message: 'must be a non-root path without query or fragment',
    });
  }
  const corsEnabled =
    parseValue(
      'CORS_ENABLED',
      booleanSchema,
      requiredValue(source, 'CORS_ENABLED', 'false', base.strict, issues),
      issues,
    ) ?? false;
  const allowedOrigins = parseOrigins(
    source.CORS_ALLOWED_ORIGINS,
    base.runtime.environment,
    issues,
  );
  if (corsEnabled && base.strict && allowedOrigins.length === 0) {
    issues.push({
      variable: 'CORS_ALLOWED_ORIGINS',
      message: 'must not be empty when CORS is enabled in staging/production',
    });
  }
  const database = parseDatabase(source, base.strict, issues);
  const authentication = parseAuthentication(source, base.strict, issues);
  const identityHttp = parseIdentityHttp(
    source,
    base.runtime.environment,
    authentication.session.ttlSeconds,
    issues,
  );
  const emailConfiguration = parseEmailConfig(source, base.runtime.environment, issues);
  const matchmaking = Object.freeze({
    requestTtlSeconds: parseBoundedInteger(
      source,
      'MATCHMAKING_REQUEST_TTL_SECONDS',
      900,
      60,
      3600,
      issues,
    ),
    proposalTtlSeconds: parseBoundedInteger(
      source,
      'MATCHMAKING_PROPOSAL_TTL_SECONDS',
      30,
      10,
      120,
      issues,
    ),
    maxActiveRequestsPerUser: parseBoundedInteger(
      source,
      'MATCHMAKING_MAX_ACTIVE_REQUESTS_PER_USER',
      1,
      1,
      1,
      issues,
    ) as 1,
    maxCandidatesPerEvaluation: parseBoundedInteger(
      source,
      'MATCHMAKING_MAX_CANDIDATES_PER_EVALUATION',
      50,
      1,
      100,
      issues,
    ),
  });
  if (matchmaking.proposalTtlSeconds >= matchmaking.requestTtlSeconds)
    issues.push({
      variable: 'MATCHMAKING_PROPOSAL_TTL_SECONDS',
      message: 'must be shorter than MATCHMAKING_REQUEST_TTL_SECONDS',
    });
  const matches = Object.freeze({
    readyTtlSeconds: parseBoundedInteger(source, 'MATCH_READY_TTL_SECONDS', 120, 30, 900, issues),
    entryReservationTtlSeconds: parseBoundedInteger(
      source,
      'MATCH_ENTRY_RESERVATION_TTL_SECONDS',
      300,
      30,
      1800,
      issues,
    ),
    settlementDelaySeconds: parseBoundedInteger(
      source,
      'MATCH_SETTLEMENT_DELAY_SECONDS',
      86_400,
      0,
      604_800,
      issues,
    ),
    resultSubmissionTtlSeconds: parseBoundedInteger(
      source,
      'MATCH_RESULT_SUBMISSION_TTL_SECONDS',
      3600,
      300,
      86_400,
      issues,
    ),
    resultConflictResolutionTtlSeconds: parseBoundedInteger(
      source,
      'MATCH_RESULT_CONFLICT_RESOLUTION_TTL_SECONDS',
      86_400,
      3600,
      604_800,
      issues,
    ),
    evidenceSubmissionTtlSeconds: parseBoundedInteger(
      source,
      'MATCH_EVIDENCE_SUBMISSION_TTL_SECONDS',
      86_400,
      300,
      604_800,
      issues,
    ),
    disputeOpenTtlSeconds: parseBoundedInteger(
      source,
      'MATCH_DISPUTE_OPEN_TTL_SECONDS',
      86_400,
      300,
      604_800,
      issues,
    ),
    disputeResponseTtlSeconds: parseBoundedInteger(
      source,
      'MATCH_DISPUTE_RESPONSE_TTL_SECONDS',
      86_400,
      300,
      604_800,
      issues,
    ),
    disputeReviewTtlSeconds: parseBoundedInteger(
      source,
      'MATCH_DISPUTE_REVIEW_TTL_SECONDS',
      259_200,
      3600,
      2_592_000,
      issues,
    ),
  });
  const rating = Object.freeze({
    initialValue: parseBoundedInteger(source, 'RATING_INITIAL_VALUE', 1000, 100, 3000, issues),
    provisionalMatchCount: parseBoundedInteger(
      source,
      'RATING_PROVISIONAL_MATCH_COUNT',
      10,
      0,
      100,
      issues,
    ),
    provisionalKFactor: parseBoundedInteger(
      source,
      'RATING_PROVISIONAL_K_FACTOR',
      40,
      1,
      200,
      issues,
    ),
    establishedKFactor: parseBoundedInteger(
      source,
      'RATING_ESTABLISHED_K_FACTOR',
      24,
      1,
      200,
      issues,
    ),
    minimumValue: parseBoundedInteger(source, 'RATING_MINIMUM_VALUE', 100, 0, 2999, issues),
    maximumValue: parseBoundedInteger(source, 'RATING_MAXIMUM_VALUE', 3000, 101, 10_000, issues),
    matchDelaySeconds: parseBoundedInteger(
      source,
      'MATCH_RATING_DELAY_SECONDS',
      86_400,
      0,
      604_800,
      issues,
    ),
    leaderboardMinimumMatchesPlayed: parseBoundedInteger(
      source,
      'LEADERBOARD_MIN_MATCHES_PLAYED',
      1,
      0,
      1000,
      issues,
    ),
  });
  const notifications = Object.freeze({
    deliveryMaxAttempts: parseBoundedInteger(
      source,
      'NOTIFICATION_DELIVERY_MAX_ATTEMPTS',
      5,
      1,
      20,
      issues,
    ),
    retryBaseSeconds: parseBoundedInteger(
      source,
      'NOTIFICATION_DELIVERY_RETRY_BASE_SECONDS',
      60,
      1,
      86_400,
      issues,
    ),
    retryMaxSeconds: parseBoundedInteger(
      source,
      'NOTIFICATION_DELIVERY_RETRY_MAX_SECONDS',
      3600,
      1,
      604_800,
      issues,
    ),
    claimLeaseSeconds: parseBoundedInteger(
      source,
      'NOTIFICATION_OUTBOX_CLAIM_LEASE_SECONDS',
      60,
      10,
      3600,
      issues,
    ),
  });
  if (notifications.retryMaxSeconds < notifications.retryBaseSeconds)
    issues.push({
      variable: 'NOTIFICATION_DELIVERY_RETRY_MAX_SECONDS',
      message: 'must be at least NOTIFICATION_DELIVERY_RETRY_BASE_SECONDS',
    });
  if (
    rating.minimumValue >= rating.maximumValue ||
    rating.initialValue < rating.minimumValue ||
    rating.initialValue > rating.maximumValue
  )
    issues.push({
      variable: 'RATING_INITIAL_VALUE',
      message: 'must be within the configured rating bounds',
    });
  if (rating.establishedKFactor > rating.provisionalKFactor)
    issues.push({
      variable: 'RATING_ESTABLISHED_K_FACTOR',
      message: 'must not exceed RATING_PROVISIONAL_K_FACTOR',
    });

  return finish(issues, {
    runtime: base.runtime,
    network: base.network,
    database,
    authentication,
    identityHttp,
    admin,
    email: emailConfiguration.email,
    identityEmail: emailConfiguration.identityEmail,
    matchmaking,
    matches,
    rating,
    notifications,
    hardening,
    api: Object.freeze({
      port,
      prefix,
      cors: Object.freeze({ enabled: corsEnabled, allowedOrigins }),
    }),
    warnings: base.warnings,
  });
}

export function createWorkerConfig(
  source: EnvironmentSource,
  options: ConfigOptions,
): WorkerServiceConfig {
  const issues: { variable: string; message: string }[] = [];
  const base = parseRuntime(source, options, issues);
  const hardening = createProductionHardeningConfig(source);
  const shutdownTimeoutMs =
    parseValue(
      'WORKER_SHUTDOWN_TIMEOUT_MS',
      timeoutSchema,
      requiredValue(source, 'WORKER_SHUTDOWN_TIMEOUT_MS', '10000', base.strict, issues),
      issues,
    ) ?? 10_000;
  const database = parseDatabase(source, base.strict, issues);

  return finish(issues, {
    runtime: base.runtime,
    database,
    hardening,
    worker: Object.freeze({ shutdownTimeoutMs }),
    warnings: base.warnings,
  });
}
