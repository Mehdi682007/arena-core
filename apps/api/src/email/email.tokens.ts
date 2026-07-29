import type { EmailSender } from '@arena-core/email';

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');
export type ApiEmailSender = EmailSender & {
  verify?(): Promise<void>;
  close?(): void;
};
