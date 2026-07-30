import type { EventEmitter } from 'node:events';

export type ShutdownSignal = 'SIGINT' | 'SIGTERM';
export type SignalSource = Pick<EventEmitter, 'once' | 'removeListener'>;

export function waitForShutdownSignal(source: SignalSource = process): Promise<ShutdownSignal> {
  return new Promise((resolve) => {
    // A pending Promise and signal listeners do not keep Node's event loop alive. The Worker is a
    // daemon, so retain one explicit handle until its supervisor asks it to shut down.
    const keepAlive = setInterval(() => undefined, 2_147_483_647);
    const cleanup = (): void => {
      clearInterval(keepAlive);
      source.removeListener('SIGINT', onInterrupt);
      source.removeListener('SIGTERM', onTerminate);
    };
    const finish = (signal: ShutdownSignal): void => {
      cleanup();
      resolve(signal);
    };
    const onInterrupt = (): void => {
      finish('SIGINT');
    };
    const onTerminate = (): void => {
      finish('SIGTERM');
    };

    source.once('SIGINT', onInterrupt);
    source.once('SIGTERM', onTerminate);
  });
}
