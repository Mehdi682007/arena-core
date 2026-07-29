import { Global, Module, type DynamicModule } from '@nestjs/common';
import type { RuntimeConfig, WorkerServiceConfig } from '@arena-core/config';

export const RUNTIME_CONFIG = Symbol('RUNTIME_CONFIG');
export const WORKER_CONFIG = Symbol('WORKER_CONFIG');

@Global()
@Module({})
export class ConfigModule {
  public static register(config: WorkerServiceConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        { provide: RUNTIME_CONFIG, useValue: config.runtime satisfies RuntimeConfig },
        { provide: WORKER_CONFIG, useValue: config },
      ],
      exports: [RUNTIME_CONFIG, WORKER_CONFIG],
    };
  }
}
