import type { EmailMessage } from '../domain/email-message';

export interface EmailSendResult {
  readonly messageId?: string;
  readonly accepted: readonly string[];
  readonly rejected: readonly string[];
}

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
