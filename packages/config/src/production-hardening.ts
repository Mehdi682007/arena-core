import { createHash } from 'node:crypto';

export type RuntimeEnvironment = 'local' | 'test' | 'staging' | 'production';
export type TrustProxyMode = 'none' | 'loopback' | 'private' | 'hop-count';
export type MigrationMode = 'external' | 'disabled';

export interface ProductionHardeningConfig {
  readonly environment: RuntimeEnvironment;
  readonly nodeEnvironment: 'development' | 'test' | 'production';
  readonly baseUrls: Readonly<{
    app?: string | undefined;
    api?: string | undefined;
    web?: string | undefined;
  }>;
  readonly secrets: Readonly<{ session?: string | undefined; csrf?: string | undefined }>;
  readonly proxy: Readonly<{ mode: TrustProxyMode; hops?: number }>;
  readonly cors: Readonly<{ allowedOrigins: readonly string[]; allowNoOrigin: boolean }>;
  readonly http: Readonly<{
    bodyLimitBytes: number;
    headersTimeoutMs: number;
    requestTimeoutMs: number;
    keepAliveTimeoutMs: number;
  }>;
  readonly security: Readonly<{
    hsts: boolean;
    hstsIncludeSubDomains: boolean;
    exposeErrors: boolean;
    debugRoutes: boolean;
  }>;
  readonly operations: Readonly<{
    shutdownTimeoutMs: number;
    rateLimitEnabled: boolean;
    migrationMode: MigrationMode;
    maintenanceMode: boolean;
    buildSha?: string | undefined;
  }>;
}

export interface ProductionPolicyResult {
  readonly valid: boolean;
  readonly violations: readonly string[];
  readonly warnings: readonly string[];
}

export class ProductionConfigurationError extends Error {
  public readonly code = 'PRODUCTION_POLICY_VIOLATION';
  public readonly variables: readonly string[];

  public constructor(variables: readonly string[]) {
    super(`Production policy violation: ${[...new Set(variables)].join(', ')}`);
    this.name = 'ProductionConfigurationError';
    this.variables = Object.freeze([...new Set(variables)]);
  }
}

const environments = new Set<RuntimeEnvironment>(['local', 'test', 'staging', 'production']);
const proxyModes = new Set<TrustProxyMode>(['none', 'loopback', 'private', 'hop-count']);
const unsafeSecrets = /^(?:change-?me|secret|password|development|test-secret|your-secret)$/i;

function value(
  source: Readonly<Record<string, string | undefined>>,
  name: string,
): string | undefined {
  const normalized = source[name]?.trim();
  return normalized ? normalized : undefined;
}

function strictBoolean(
  source: Readonly<Record<string, string | undefined>>,
  name: string,
  fallback: boolean,
  errors: string[],
): boolean {
  const raw = value(source, name);
  if (raw === undefined) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  errors.push(name);
  return fallback;
}

function integer(
  source: Readonly<Record<string, string | undefined>>,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
  errors: string[],
): number {
  const raw = value(source, name);
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) {
    errors.push(name);
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    errors.push(name);
    return fallback;
  }
  return parsed;
}

export function normalizeOrigins(raw: string | undefined): readonly string[] {
  const origins = new Set<string>();
  for (const entry of (raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)) {
    if (entry === '*') throw new ProductionConfigurationError(['ALLOWED_ORIGINS']);
    try {
      const parsed = new URL(entry);
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        parsed.pathname !== '/' ||
        parsed.search ||
        parsed.hash ||
        parsed.origin === 'null'
      ) {
        throw new Error('invalid origin');
      }
      origins.add(parsed.origin);
    } catch {
      throw new ProductionConfigurationError(['ALLOWED_ORIGINS']);
    }
  }
  if (origins.size > 50) throw new ProductionConfigurationError(['ALLOWED_ORIGINS']);
  return Object.freeze([...origins]);
}

export function createProductionHardeningConfig(
  source: Readonly<Record<string, string | undefined>>,
): ProductionHardeningConfig {
  const errors: string[] = [];
  const legacyNodeEnvironment = value(source, 'NODE_ENV') ?? 'development';
  const explicitAppEnvironment = value(source, 'APP_ENV');
  const inferred = legacyNodeEnvironment === 'test' ? 'test' : 'local';
  const environmentValue = explicitAppEnvironment ?? inferred;
  const environment = environments.has(environmentValue as RuntimeEnvironment)
    ? (environmentValue as RuntimeEnvironment)
    : 'local';
  if (!environments.has(environmentValue as RuntimeEnvironment)) errors.push('APP_ENV');
  const expectedNodeEnvironment =
    environment === 'production' || environment === 'staging'
      ? 'production'
      : environment === 'test'
        ? 'test'
        : 'development';
  if (explicitAppEnvironment !== undefined && legacyNodeEnvironment !== expectedNodeEnvironment)
    errors.push('APP_ENV/NODE_ENV');

  const proxyValue = value(source, 'TRUST_PROXY_MODE') ?? 'none';
  const proxyMode = proxyModes.has(proxyValue as TrustProxyMode)
    ? (proxyValue as TrustProxyMode)
    : 'none';
  if (!proxyModes.has(proxyValue as TrustProxyMode)) errors.push('TRUST_PROXY_MODE');
  const hops =
    proxyMode === 'hop-count' ? integer(source, 'TRUST_PROXY_HOPS', 1, 1, 10, errors) : undefined;
  let allowedOrigins: readonly string[] = [];
  try {
    allowedOrigins = normalizeOrigins(value(source, 'ALLOWED_ORIGINS'));
  } catch {
    errors.push('ALLOWED_ORIGINS');
  }

  const config: ProductionHardeningConfig = Object.freeze({
    environment,
    nodeEnvironment: expectedNodeEnvironment,
    baseUrls: Object.freeze({
      ...(value(source, 'APP_BASE_URL') ? { app: value(source, 'APP_BASE_URL') } : {}),
      ...(value(source, 'API_BASE_URL') ? { api: value(source, 'API_BASE_URL') } : {}),
      ...(value(source, 'WEB_BASE_URL') ? { web: value(source, 'WEB_BASE_URL') } : {}),
    }),
    secrets: Object.freeze({
      ...(value(source, 'SESSION_SECRET') ? { session: value(source, 'SESSION_SECRET') } : {}),
      ...(value(source, 'CSRF_SECRET') ? { csrf: value(source, 'CSRF_SECRET') } : {}),
    }),
    proxy: Object.freeze({ mode: proxyMode, ...(hops === undefined ? {} : { hops }) }),
    cors: Object.freeze({
      allowedOrigins,
      allowNoOrigin: strictBoolean(source, 'CORS_ALLOW_NO_ORIGIN', true, errors),
    }),
    http: Object.freeze({
      bodyLimitBytes: integer(source, 'HTTP_BODY_LIMIT_BYTES', 16_384, 1_024, 1_048_576, errors),
      headersTimeoutMs: integer(source, 'HTTP_HEADERS_TIMEOUT_MS', 15_000, 1_000, 120_000, errors),
      requestTimeoutMs: integer(source, 'HTTP_REQUEST_TIMEOUT_MS', 30_000, 1_000, 120_000, errors),
      keepAliveTimeoutMs: integer(
        source,
        'HTTP_KEEP_ALIVE_TIMEOUT_MS',
        5_000,
        1_000,
        60_000,
        errors,
      ),
    }),
    security: Object.freeze({
      hsts: strictBoolean(
        source,
        'HSTS_ENABLED',
        environment !== 'local' && environment !== 'test',
        errors,
      ),
      hstsIncludeSubDomains: strictBoolean(source, 'HSTS_INCLUDE_SUBDOMAINS', false, errors),
      exposeErrors: strictBoolean(source, 'EXPOSE_ERROR_DETAILS', environment === 'local', errors),
      debugRoutes: strictBoolean(source, 'DEBUG_ROUTES_ENABLED', false, errors),
    }),
    operations: Object.freeze({
      shutdownTimeoutMs: integer(source, 'SHUTDOWN_TIMEOUT_MS', 10_000, 1_000, 60_000, errors),
      rateLimitEnabled: strictBoolean(source, 'RATE_LIMIT_ENABLED', true, errors),
      migrationMode: (value(source, 'MIGRATION_MODE') ?? 'external') as MigrationMode,
      maintenanceMode: strictBoolean(source, 'MAINTENANCE_MODE', false, errors),
      ...(value(source, 'BUILD_SHA') ? { buildSha: value(source, 'BUILD_SHA') } : {}),
    }),
  });
  if (!['external', 'disabled'].includes(config.operations.migrationMode))
    errors.push('MIGRATION_MODE');
  if (errors.length > 0) throw new ProductionConfigurationError(errors);
  const result = validateProductionPolicy(config, source);
  if (!result.valid && environment === 'production')
    throw new ProductionConfigurationError(result.violations);
  if (environment === 'staging' && result.violations.length > 0)
    throw new ProductionConfigurationError(result.violations);
  return config;
}

function publicUrlIsSafe(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return (
      url.protocol === 'https:' &&
      !['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase()) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function validateProductionPolicy(
  config: ProductionHardeningConfig,
  source: Readonly<Record<string, string | undefined>> = {},
): ProductionPolicyResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  if (config.environment === 'local' || config.environment === 'test')
    return Object.freeze({
      valid: true,
      violations: Object.freeze([]),
      warnings: Object.freeze([]),
    });
  if (config.nodeEnvironment !== 'production') violations.push('NODE_ENV');
  for (const [name, url] of Object.entries(config.baseUrls))
    if (!publicUrlIsSafe(url)) violations.push(`${name.toUpperCase()}_BASE_URL`);
  for (const [name, secret] of [
    ['SESSION', config.secrets.session],
    ['CSRF', config.secrets.csrf],
  ] as const) {
    if (!secret || secret.length < 32 || unsafeSecrets.test(secret))
      violations.push(`${name.toUpperCase()}_SECRET`);
  }
  if (config.cors.allowedOrigins.length === 0) violations.push('ALLOWED_ORIGINS');
  if (config.cors.allowedOrigins.some((origin) => !publicUrlIsSafe(origin)))
    violations.push('ALLOWED_ORIGINS');
  if (!strictBoolean(source, 'COOKIE_SECURE', false, violations)) violations.push('COOKIE_SECURE');
  if (!config.operations.rateLimitEnabled) violations.push('RATE_LIMIT_ENABLED');
  if (config.operations.migrationMode !== 'external') violations.push('MIGRATION_MODE');
  if (config.security.exposeErrors) violations.push('EXPOSE_ERROR_DETAILS');
  if (config.security.debugRoutes) violations.push('DEBUG_ROUTES_ENABLED');
  if (value(source, 'DATABASE_ENABLED') !== 'true' && !config.operations.maintenanceMode)
    violations.push('DATABASE_ENABLED');
  if (config.proxy.mode === 'hop-count' && config.proxy.hops === undefined)
    violations.push('TRUST_PROXY_HOPS');
  if (config.environment === 'staging') warnings.push('Staging uses production security policy.');
  return Object.freeze({
    valid: violations.length === 0,
    violations: Object.freeze([...new Set(violations)]),
    warnings: Object.freeze(warnings),
  });
}

export function configFingerprint(
  config: ProductionHardeningConfig,
  features: Readonly<Record<string, boolean | string | number>>,
): Readonly<Record<string, unknown>> {
  const safe = {
    environment: config.environment,
    proxyMode: config.proxy.mode,
    allowedOriginCount: config.cors.allowedOrigins.length,
    buildSha: config.operations.buildSha,
    features,
  };
  return Object.freeze({
    ...safe,
    digest: createHash('sha256').update(JSON.stringify(safe)).digest('hex').slice(0, 16),
  });
}
