import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { createWorkerConfig } from '@arena-core/config';
import { NestFactory } from '@nestjs/core';
import packageMetadata from '../package.json';
import { closeWithTimeout } from './graceful-close';
import { waitForShutdownSignal } from './shutdown-signal';
import { WorkerModule } from './worker.module';

function enableSupervisorShutdownBridge(): void {
  if (process.send === undefined) {
    return;
  }

  process.once('message', (message: unknown) => {
    if (message === 'shutdown:SIGTERM') {
      process.emit('SIGTERM');
    }
  });
}

async function bootstrap(): Promise<void> {
  const config = createWorkerConfig(process.env, { packageVersion: packageMetadata.version });
  for (const warning of config.warnings) Logger.warn(warning, 'Configuration');
  const application = await NestFactory.createApplicationContext(WorkerModule.register(config));

  Logger.log(
    JSON.stringify({
      event: 'worker.started',
      service: 'worker',
      environment: config.runtime.environment,
      version: config.runtime.version,
    }),
    'Worker',
  );

  enableSupervisorShutdownBridge();
  const signal = await waitForShutdownSignal();
  Logger.log(JSON.stringify({ event: 'worker.stopping', signal }), 'Worker');
  await closeWithTimeout(() => application.close(), config.worker.shutdownTimeoutMs);
  Logger.log(JSON.stringify({ event: 'worker.stopped' }), 'Worker');
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown bootstrap failure';
  const stack = error instanceof Error ? error.stack : undefined;
  Logger.error(message, stack, 'WorkerBootstrap');
  process.exitCode = 1;
});
