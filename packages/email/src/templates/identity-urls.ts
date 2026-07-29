import { EmailError } from '../domain/email-errors';

function build(baseUrl: string, path: string, token: string): string {
  try {
    const base = new URL(baseUrl);
    if (
      !['http:', 'https:'].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      !path.startsWith('/') ||
      path.startsWith('//') ||
      /[?#\r\n]/.test(path)
    ) {
      throw new Error('invalid');
    }
    const url = new URL(path, `${base.origin}${base.pathname.replace(/\/?$/, '/')}`);
    if (url.origin !== base.origin) throw new Error('open redirect');
    url.searchParams.set('token', token);
    return url.toString();
  } catch {
    throw new EmailError('EMAIL_CONFIGURATION_ERROR');
  }
}

export const buildVerificationUrl = (baseUrl: string, path: string, token: string): string =>
  build(baseUrl, path, token);

export const buildPasswordResetUrl = (baseUrl: string, path: string, token: string): string =>
  build(baseUrl, path, token);
