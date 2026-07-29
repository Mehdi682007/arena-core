import { Module, type DynamicModule } from '@nestjs/common';
import type { WorkerServiceConfig } from '@arena-core/config';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { WorkerHealthService } from './health/worker-health.service';

@Module({})
export class WorkerModule {
  public static register(config: WorkerServiceConfig): DynamicModule {
    return {
      module: WorkerModule,
      imports: [ConfigModule.register(config), DatabaseModule],
      providers: [WorkerHealthService],
    };
  }
}
