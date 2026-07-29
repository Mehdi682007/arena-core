import { Inject, Injectable } from '@nestjs/common';
import type { ApiServiceConfig, Locale } from '@arena-core/config';
import {
  buildPasswordResetUrl,
  buildVerificationUrl,
  createEmailMessage,
  EmailError,
  IdentityEmailTemplateRenderer,
  type EmailSender,
} from '@arena-core/email';
import { API_CONFIG } from '../../config/config.module';
import { EMAIL_SENDER } from '../../email/email.tokens';

export interface IdentityMessageDispatcher {
  sendVerificationEmail(input: {
    email: string;
    token: string;
    expiresAt: Date;
    locale?: Locale;
    recipientName?: string;
  }): Promise<void>;
  sendPasswordResetEmail(input: {
    email: string;
    token: string;
    expiresAt: Date;
    locale?: Locale;
    recipientName?: string;
  }): Promise<void>;
}

export const IDENTITY_MESSAGE_DISPATCHER = Symbol('IDENTITY_MESSAGE_DISPATCHER');

@Injectable()
export class IdentityEmailDispatcher implements IdentityMessageDispatcher {
  readonly #renderer: IdentityEmailTemplateRenderer;

  public constructor(
    @Inject(API_CONFIG) private readonly config: ApiServiceConfig,
    @Inject(EMAIL_SENDER) private readonly sender: EmailSender,
  ) {
    this.#renderer = new IdentityEmailTemplateRenderer(config.identityEmail.appName);
  }

  public async sendVerificationEmail(input: {
    email: string;
    token: string;
    expiresAt: Date;
    locale?: Locale;
    recipientName?: string;
  }): Promise<void> {
    const rendered = this.#renderer.renderVerificationEmail({
      locale: input.locale ?? this.config.identityEmail.defaultLocale,
      verificationUrl: buildVerificationUrl(
        this.config.identityEmail.publicBaseUrl,
        this.config.identityEmail.verificationPath,
        input.token,
      ),
      expiresAt: input.expiresAt,
      ...(input.recipientName === undefined ? {} : { recipientName: input.recipientName }),
    });
    await this.deliver(input.email, rendered, 'identity-verification');
  }

  public async sendPasswordResetEmail(input: {
    email: string;
    token: string;
    expiresAt: Date;
    locale?: Locale;
    recipientName?: string;
  }): Promise<void> {
    const rendered = this.#renderer.renderPasswordResetEmail({
      locale: input.locale ?? this.config.identityEmail.defaultLocale,
      resetUrl: buildPasswordResetUrl(
        this.config.identityEmail.publicBaseUrl,
        this.config.identityEmail.passwordResetPath,
        input.token,
      ),
      expiresAt: input.expiresAt,
      ...(input.recipientName === undefined ? {} : { recipientName: input.recipientName }),
    });
    await this.deliver(input.email, rendered, 'identity-password-reset');
  }

  private async deliver(
    address: string,
    rendered: { subject: string; text: string; html: string },
    tag: string,
  ): Promise<void> {
    const result = await this.sender.send(
      createEmailMessage({
        to: { address },
        from: this.config.email.from,
        ...(this.config.email.replyTo === undefined ? {} : { replyTo: this.config.email.replyTo }),
        ...rendered,
        tags: [tag],
      }),
    );
    if (result.accepted.length === 0 || result.rejected.length > 0) {
      throw new EmailError('EMAIL_DELIVERY_REJECTED');
    }
  }
}
