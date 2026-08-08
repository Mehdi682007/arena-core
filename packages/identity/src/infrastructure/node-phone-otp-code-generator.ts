import { randomInt } from 'node:crypto';
import type { PhoneOtpCodeGenerator } from '../ports/phone-otp-code-generator';

export class NodePhoneOtpCodeGenerator implements PhoneOtpCodeGenerator {
  public generate(digits: number): string {
    if (!Number.isInteger(digits) || digits < 4 || digits > 8) {
      throw new RangeError('OTP digits must be between 4 and 8.');
    }

    const maximum = 10 ** digits;

    return randomInt(0, maximum).toString().padStart(digits, '0');
  }
}
