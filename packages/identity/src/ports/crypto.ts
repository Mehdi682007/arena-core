import type { TokenKind } from '../domain/identity-types';

export interface PasswordHashResult {
  readonly encodedHash: string;
  readonly algorithm: 'argon2id';
}

export interface PasswordHasher {
  hash(password: string): Promise<PasswordHashResult>;
  verify(password: string, encodedHash: string): Promise<boolean>;
  needsRehash(encodedHash: string): boolean;
}

export interface TokenService {
  generateToken(byteLength: number): string;
  hashToken(type: TokenKind, token: string): string;
  hashIp(ip: string): string;
  constantTimeEqual(left: string, right: string): boolean;
}

export interface Clock {
  now(): Date;
}
