import { Inject, Injectable } from '@nestjs/common';
import type { RuntimeConfig } from '@arena-core/config';
import type { ApiReadiness, HttpServiceHealth } from '@arena-core/contracts';
import { RUNTIME_CONFIG } from '../config/config.module';
import { DatabaseService } from '../database/database.service';
import { RuntimeState } from '../platform/runtime-state';

@Injectable()
export class HealthService {
  public constructor(
    @Inject(RUNTIME_CONFIG) private readonly runtime: RuntimeConfig,
    private readonly database: DatabaseService,
    private readonly state: RuntimeState = new RuntimeState(),
  ) {}

  public getHealth(now: Date = new Date()): HttpServiceHealth {
    return {
      service: 'api',
      status: 'ok',
      version: this.runtime.version,
      environment: this.runtime.environment,
      timestamp: now.toISOString(),
    };
  }

  public async getReadiness(now: Date = new Date()): Promise<ApiReadiness> {
    const database = await this.database.getStatus();
    return {
      service: 'api',
      status: database === 'down' || this.state.shuttingDown ? 'not_ready' : 'ready',
      dependencies: { database },
      timestamp: now.toISOString(),
    };
  }
}
