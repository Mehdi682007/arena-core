import { IdentityError } from './identity-errors';

export function normalizePhoneE164(value: string): string {
  let phone = value.trim().replace(/[\s().-]+/g, '');

  if (phone.startsWith('00')) {
    phone = `+${phone.slice(2)}`;
  }

  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) {
    throw new IdentityError('INVALID_PHONE');
  }

  return phone;
}
