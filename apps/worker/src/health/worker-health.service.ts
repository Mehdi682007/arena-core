import { Inject, Injectable } from '@nestjs/common';
import type { RuntimeConfig } from '@arena-core/config';
import type { WorkerServiceHealth } from '@arena-core/contracts';
import { RUNTIME_CONFIG } from '../config/config.module';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class WorkerHealthService {
  readonly #startedAt = new Date();

  public constructor(
    @Inject(RUNTIME_CONFIG) private readonly runtime: RuntimeConfig,
    private readonly database: DatabaseService,
  ) {}

  public getSnapshot(): WorkerServiceHealth {
    return {
      service: 'worker',
      status: 'ok',
      version: this.runtime.version,
      environment: this.runtime.environment,
      startedAt: this.#startedAt.toISOString(),
      database: this.database.getStatus(),
    };
  }
}
