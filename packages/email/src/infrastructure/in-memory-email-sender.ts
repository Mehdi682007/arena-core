import type { EmailMessage } from '../domain/email-message';
import type { EmailSender, EmailSendResult } from '../ports/email-sender';
import { EmailError } from '../domain/email-errors';

export class DisabledEmailSender implements EmailSender {
  public send(): Promise<EmailSendResult> {
    return Promise.reject(new EmailError('EMAIL_DELIVERY_DISABLED'));
  }
}

export class InMemoryEmailSender implements EmailSender {
  readonly #messages: EmailMessage[] = [];

  public get messages(): readonly EmailMessage[] {
    return Object.freeze([...this.#messages]);
  }

  public send(message: EmailMessage): Promise<EmailSendResult> {
    this.#messages.push(message);
    return Promise.resolve(
      Object.freeze({
        accepted: Object.freeze([message.to.address]),
        rejected: Object.freeze([]),
      }),
    );
  }

  public clear(): void {
    this.#messages.length = 0;
  }
}
