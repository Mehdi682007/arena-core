export type EmailErrorCode =
  | 'EMAIL_DELIVERY_DISABLED'
  | 'EMAIL_DELIVERY_UNAVAILABLE'
  | 'EMAIL_DELIVERY_REJECTED'
  | 'EMAIL_TEMPLATE_ERROR'
  | 'EMAIL_CONFIGURATION_ERROR';

const messages: Record<EmailErrorCode, string> = {
  EMAIL_DELIVERY_DISABLED: 'Email delivery is disabled.',
  EMAIL_DELIVERY_UNAVAILABLE: 'Email delivery is temporarily unavailable.',
  EMAIL_DELIVERY_REJECTED: 'Email delivery was rejected.',
  EMAIL_TEMPLATE_ERROR: 'Email template rendering failed.',
  EMAIL_CONFIGURATION_ERROR: 'Email configuration is invalid.',
};

export class EmailError extends Error {
  public constructor(
    public readonly code: EmailErrorCode,
    options?: ErrorOptions,
  ) {
    super(messages[code], options);
    this.name = 'EmailError';
  }

  public toJSON(): Readonly<{ code: EmailErrorCode; message: string }> {
    return Object.freeze({ code: this.code, message: this.message });
  }
}
