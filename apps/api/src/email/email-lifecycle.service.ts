import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { ApiServiceConfig } from '@arena-core/config';
import { API_CONFIG } from '../config/config.module';
import { EMAIL_SENDER, type ApiEmailSender } from './email.tokens';

@Injectable()
export class EmailLifecycleService implements OnModuleInit, OnModuleDestroy {
  public constructor(
    @Inject(API_CONFIG) private readonly config: ApiServiceConfig,
    @Inject(EMAIL_SENDER) private readonly sender: ApiEmailSender,
  ) {}

  public async onModuleInit(): Promise<void> {
    if (
      this.config.email.enabled &&
      this.config.identityEmail.deliveryRequired &&
      this.sender.verify !== undefined
    ) {
      await this.sender.verify();
    }
  }

  public onModuleDestroy(): void {
    this.sender.close?.();
  }
}
