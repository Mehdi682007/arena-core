export interface OtpCodeGenerator {
  generateNumericCode(digits: number): string;
}
