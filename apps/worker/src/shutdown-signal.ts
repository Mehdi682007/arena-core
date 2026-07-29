import type { EventEmitter } from 'node:events';

export type ShutdownSignal = 'SIGINT' | 'SIGTERM';
export type SignalSource = Pick<EventEmitter, 'once' | 'removeListener'>;

export function waitForShutdownSignal(source: SignalSource = process): Promise<ShutdownSignal> {
  return new Promise((resolve) => {
    const cleanup = (): void => {
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
