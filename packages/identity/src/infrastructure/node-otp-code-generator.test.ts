import { describe, expect, it } from 'vitest';
import { NodeOtpCodeGenerator } from './node-otp-code-generator';

describe('NodeOtpCodeGenerator', () => {
  it('generates zero-padded numeric codes with the requested length', () => {
    const generator = new NodeOtpCodeGenerator();
    for (let index = 0; index < 100; index += 1) {
      expect(generator.generateNumericCode(6)).toMatch(/^[0-9]{6}$/);
    }
  });

  it('rejects unsupported otp lengths', () => {
    const generator = new NodeOtpCodeGenerator();
    expect(() => generator.generateNumericCode(3)).toThrow(RangeError);
    expect(() => generator.generateNumericCode(10)).toThrow(RangeError);
  });
});
