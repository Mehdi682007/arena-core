import { EmailError } from './email-errors';

export interface EmailAddress {
  readonly address: string;
  readonly name?: string;
}

export interface EmailMessage {
  readonly to: EmailAddress;
  readonly from: EmailAddress;
  readonly replyTo?: EmailAddress;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly tags?: readonly string[];
}

function validateAddress(value: EmailAddress): EmailAddress {
  if (
    value.address.length > 320 ||
    !/^[^\s@]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value.address) ||
    /[\r\n]/.test(value.address) ||
    (value.name !== undefined &&
      (value.name.length > 120 || value.name.length === 0 || /[\r\n]/.test(value.name)))
  ) {
    throw new EmailError('EMAIL_CONFIGURATION_ERROR');
  }
  return Object.freeze({
    address: value.address,
    ...(value.name === undefined ? {} : { name: value.name }),
  });
}

export function createEmailMessage(input: EmailMessage): EmailMessage {
  if (
    input.subject.length === 0 ||
    input.subject.length > 200 ||
    /[\r\n]/.test(input.subject) ||
    input.text.length === 0 ||
    input.html.length === 0
  ) {
    throw new EmailError('EMAIL_TEMPLATE_ERROR');
  }
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.headers ?? {})) {
    if (!/^[A-Za-z0-9-]{1,64}$/.test(key) || /[\r\n]/.test(value) || value.length > 998) {
      throw new EmailError('EMAIL_CONFIGURATION_ERROR');
    }
    headers[key] = value;
  }
  return Object.freeze({
    to: validateAddress(input.to),
    from: validateAddress(input.from),
    ...(input.replyTo === undefined ? {} : { replyTo: validateAddress(input.replyTo) }),
    subject: input.subject,
    text: input.text,
    html: input.html,
    ...(Object.keys(headers).length === 0 ? {} : { headers: Object.freeze(headers) }),
    ...(input.tags === undefined ? {} : { tags: Object.freeze([...input.tags]) }),
  });
}

export function maskEmailAddress(address: string): string {
  const separator = address.lastIndexOf('@');
  if (separator <= 0) return '***';
  const local = address.slice(0, separator);
  return `${local.slice(0, 1)}***@${address.slice(separator + 1)}`;
}
