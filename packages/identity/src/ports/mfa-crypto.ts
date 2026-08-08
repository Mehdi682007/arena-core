import type { SealedMfaSecret } from '../domain/mfa-types';

export interface MfaCrypto {
  generateTotpSecret(): string;

  sealTotpSecret(secret: string): SealedMfaSecret;

  openTotpSecret(sealed: SealedMfaSecret): string;

  buildTotpUri(accountName: string, secret: string): string;

  totp(secret: string, at: Date): string;

  verifyTotp(secret: string, code: string, at: Date): boolean;

  generateRecoveryCodes(count: number): readonly string[];

  hashRecoveryCode(code: string): string;
}
