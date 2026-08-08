export interface PhoneOtpCodeGenerator {
  generate(digits: number): string;
}
