import { Controller, Get, Res } from '@nestjs/common';
import type { ApiReadiness, HttpServiceHealth } from '@arena-core/contracts';
import { HealthService } from './health.service';
import { Public } from '../identity/http/decorators/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  public constructor(private readonly healthService: HealthService) {}

  @Get()
  public getHealth(): HttpServiceHealth {
    return this.healthService.getHealth();
  }

  @Get('ready')
  public async getReadiness(
    @Res({ passthrough: true }) response: { status(code: number): unknown },
  ): Promise<ApiReadiness> {
    const readiness = await this.healthService.getReadiness();
    response.status(readiness.status === 'ready' ? 200 : 503);
    return readiness;
  }
}
