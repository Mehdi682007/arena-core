import { randomInt } from 'node:crypto';
import type { OtpCodeGenerator } from '../ports/otp-code-generator';

export class NodeOtpCodeGenerator implements OtpCodeGenerator {
  public generateNumericCode(digits: number): string {
    if (!Number.isSafeInteger(digits) || digits < 4 || digits > 9) {
      throw new RangeError('OTP digits must be an integer between 4 and 9.');
    }
    const upperBound = 10 ** digits;
    return randomInt(0, upperBound).toString().padStart(digits, '0');
  }
}
