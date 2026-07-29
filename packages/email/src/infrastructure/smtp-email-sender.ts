import nodemailer from 'nodemailer';
import type { EmailMessage } from '../domain/email-message';
import { EmailError } from '../domain/email-errors';
import type { EmailSender, EmailSendResult } from '../ports/email-sender';

export interface SmtpSenderConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly username?: string;
  readonly password?: string;
  readonly connectionTimeoutMs: number;
  readonly greetingTimeoutMs: number;
  readonly socketTimeoutMs: number;
}

export interface SmtpTransport {
  sendMail(message: Record<string, unknown>): Promise<{
    messageId?: string;
    accepted?: readonly unknown[];
    rejected?: readonly unknown[];
  }>;
  verify(): Promise<boolean>;
  close(): void;
}

export type SmtpTransportFactory = (options: Record<string, unknown>) => SmtpTransport;

const defaultFactory: SmtpTransportFactory = (options) =>
  nodemailer.createTransport(options) as unknown as SmtpTransport;

function addresses(values: readonly unknown[] | undefined): readonly string[] {
  return Object.freeze(
    (values ?? []).map((value) =>
      typeof value === 'string'
        ? value
        : typeof value === 'object' && value !== null && 'address' in value
          ? String(value.address)
          : 'unknown',
    ),
  );
}

export class SmtpEmailSender implements EmailSender {
  readonly #transport: SmtpTransport;

  public constructor(config: SmtpSenderConfig, factory: SmtpTransportFactory = defaultFactory) {
    this.#transport = factory({
      host: config.host,
      port: config.port,
      secure: config.secure,
      logger: false,
      debug: false,
      connectionTimeout: config.connectionTimeoutMs,
      greetingTimeout: config.greetingTimeoutMs,
      socketTimeout: config.socketTimeoutMs,
      ...(config.username === undefined || config.password === undefined
        ? {}
        : { auth: { user: config.username, pass: config.password } }),
    });
  }

  public async verify(): Promise<void> {
    try {
      if (!(await this.#transport.verify())) throw new Error('verification rejected');
    } catch (error) {
      throw new EmailError('EMAIL_DELIVERY_UNAVAILABLE', { cause: error });
    }
  }

  public async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const result = await this.#transport.sendMail({
        to: message.to,
        from: message.from,
        ...(message.replyTo === undefined ? {} : { replyTo: message.replyTo }),
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.headers === undefined ? {} : { headers: message.headers }),
      });
      const accepted = addresses(result.accepted);
      const rejected = addresses(result.rejected);
      if (accepted.length === 0 || rejected.length > 0) {
        throw new EmailError('EMAIL_DELIVERY_REJECTED');
      }
      return Object.freeze({
        ...(result.messageId === undefined ? {} : { messageId: result.messageId }),
        accepted,
        rejected,
      });
    } catch (error) {
      if (error instanceof EmailError) throw error;
      throw new EmailError('EMAIL_DELIVERY_UNAVAILABLE', { cause: error });
    }
  }

  public close(): void {
    this.#transport.close();
  }
}
