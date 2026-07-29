import { createApiConfig, configFingerprint } from '@arena-core/config';
import packageMetadata from '../package.json';
import { createApiApplication } from './bootstrap';
import { StructuredLogger } from './platform/structured-logger';
import { RuntimeState } from './platform/runtime-state';

async function bootstrap(): Promise<void> {
  const config = createApiConfig(process.env, { packageVersion: packageMetadata.version });
  const logger = new StructuredLogger('api', config.hardening.environment);
  for (const warning of config.warnings) logger.warn(warning, 'Configuration');
  const application = await createApiApplication(config);
  application.useLogger(logger);

  await application.listen(config.api.port, config.network.host);
  logger.write('info', 'api.started', 'Bootstrap', {
    fingerprint: configFingerprint(config.hardening, {
      databaseEnabled: config.database.enabled,
      smtpEnabled: config.email.enabled,
    }),
    version: config.runtime.version,
  });
  let stopping = false;
  const stop = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    application.get(RuntimeState).beginShutdown();
    logger.write('info', 'api.stopping', 'Bootstrap', { signal });
    const timeout = setTimeout(() => {
      logger.write('fatal', 'api.shutdown_timeout', 'Bootstrap');
      process.exitCode = 1;
    }, config.hardening.operations.shutdownTimeoutMs);
    timeout.unref();
    await application.close();
    clearTimeout(timeout);
    logger.write('info', 'api.stopped', 'Bootstrap');
  };
  process.once('SIGTERM', () => void stop('SIGTERM'));
  process.once('SIGINT', () => void stop('SIGINT'));
}

void bootstrap().catch((error: unknown) => {
  const logger = new StructuredLogger('api', 'local');
  logger.write('fatal', 'api.bootstrap_failed', 'Bootstrap', { error });
  process.exitCode = 1;
});
