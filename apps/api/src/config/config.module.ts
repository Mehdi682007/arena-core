import { Global, Module, type DynamicModule } from '@nestjs/common';
import type { ApiServiceConfig, RuntimeConfig } from '@arena-core/config';

export const API_CONFIG = Symbol('API_CONFIG');
export const RUNTIME_CONFIG = Symbol('RUNTIME_CONFIG');

@Global()
@Module({})
export class ConfigModule {
  public static register(config: ApiServiceConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        { provide: API_CONFIG, useValue: config },
        { provide: RUNTIME_CONFIG, useValue: config.runtime satisfies RuntimeConfig },
      ],
      exports: [API_CONFIG, RUNTIME_CONFIG],
    };
  }
}
