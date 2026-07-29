import { Global, Module } from '@nestjs/common';
import type { ApiServiceConfig } from '@arena-core/config';
import { DisabledEmailSender, SmtpEmailSender } from '@arena-core/email';
import { API_CONFIG } from '../config/config.module';
import {
  IDENTITY_MESSAGE_DISPATCHER,
  IdentityEmailDispatcher,
} from '../identity/email/identity-email-dispatcher';
import { EmailLifecycleService } from './email-lifecycle.service';
import { EMAIL_SENDER } from './email.tokens';

@Global()
@Module({
  providers: [
    {
      provide: EMAIL_SENDER,
      inject: [API_CONFIG],
      useFactory: (config: ApiServiceConfig) =>
        config.email.enabled
          ? new SmtpEmailSender({
              host: config.email.smtp.host,
              port: config.email.smtp.port,
              secure: config.email.smtp.secure,
              ...(config.email.smtp.username === undefined
                ? {}
                : { username: config.email.smtp.username }),
              ...(config.email.smtp.password === undefined
                ? {}
                : { password: config.email.smtp.password.reveal() }),
              connectionTimeoutMs: config.email.smtp.connectionTimeoutMs,
              greetingTimeoutMs: config.email.smtp.greetingTimeoutMs,
              socketTimeoutMs: config.email.smtp.socketTimeoutMs,
            })
          : new DisabledEmailSender(),
    },
    {
      provide: IDENTITY_MESSAGE_DISPATCHER,
      useClass: IdentityEmailDispatcher,
    },
    EmailLifecycleService,
  ],
  exports: [EMAIL_SENDER, IDENTITY_MESSAGE_DISPATCHER],
})
export class EmailModule {}
