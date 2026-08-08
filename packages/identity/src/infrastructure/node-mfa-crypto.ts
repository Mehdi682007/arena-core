import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { IdentityError } from '../domain/identity-errors';
import type { SealedMfaSecret } from '../domain/mfa-types';
import type { MfaCrypto } from '../ports/mfa-crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const issuer = 'Arena Core';
const periodSeconds = 30;
const digits = 6;

function base32Encode(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += alphabet.charAt((value >>> (bits - 5)) & 31);

      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet.charAt((value << (5 - bits)) & 31);
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const normalized = input.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    const index = alphabet.indexOf(character);

    if (index < 0) {
      throw new IdentityError('IDENTITY_PERSISTENCE_FAILURE');
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);

      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function equalText(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');

  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export class NodeMfaCrypto implements MfaCrypto {
  readonly #encryptionKey: Buffer;
  readonly #recoveryKey: Buffer;

  public constructor(masterKey: string) {
    if (masterKey.length < 32) {
      throw new RangeError('MFA master key must contain at least 32 characters.');
    }

    const key = Buffer.from(masterKey, 'utf8');

    this.#encryptionKey = Buffer.from(
      hkdfSync('sha256', key, Buffer.alloc(0), Buffer.from('arena-core:mfa-encryption:v1'), 32),
    );

    this.#recoveryKey = Buffer.from(
      hkdfSync('sha256', key, Buffer.alloc(0), Buffer.from('arena-core:mfa-recovery:v1'), 32),
    );
  }

  public generateTotpSecret(): string {
    return base32Encode(randomBytes(20));
  }

  public sealTotpSecret(secret: string): SealedMfaSecret {
    const iv = randomBytes(12);

    const cipher = createCipheriv('aes-256-gcm', this.#encryptionKey, iv);

    cipher.setAAD(Buffer.from('arena-core:mfa-totp:v1'));

    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);

    return Object.freeze({
      ciphertext: encrypted.toString('base64url'),
      iv: iv.toString('base64url'),
      tag: cipher.getAuthTag().toString('base64url'),
    });
  }

  public openTotpSecret(sealed: SealedMfaSecret): string {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.#encryptionKey,
        Buffer.from(sealed.iv, 'base64url'),
      );

      decipher.setAAD(Buffer.from('arena-core:mfa-totp:v1'));

      decipher.setAuthTag(Buffer.from(sealed.tag, 'base64url'));

      return Buffer.concat([
        decipher.update(Buffer.from(sealed.ciphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch (error) {
      throw new IdentityError('IDENTITY_PERSISTENCE_FAILURE', { cause: error });
    }
  }

  public buildTotpUri(accountName: string, secret: string): string {
    const label = encodeURIComponent(`${issuer}:${accountName}`);

    return [
      `otpauth://totp/${label}`,
      `?secret=${encodeURIComponent(secret)}`,
      `&issuer=${encodeURIComponent(issuer)}`,
      '&algorithm=SHA1',
      `&digits=${String(digits)}`,
      `&period=${String(periodSeconds)}`,
    ].join('');
  }

  public totp(secret: string, at: Date): string {
    const counter = BigInt(Math.floor(at.getTime() / 1_000 / periodSeconds));

    const counterBuffer = Buffer.alloc(8);

    counterBuffer.writeBigUInt64BE(counter);

    const digest = createHmac('sha1', base32Decode(secret)).update(counterBuffer).digest();

    const lastByte = digest.at(-1);

    if (lastByte === undefined) {
      throw new IdentityError('IDENTITY_PERSISTENCE_FAILURE');
    }

    const offset = lastByte & 0x0f;

    const binary = digest.readUInt32BE(offset) & 0x7fffffff;

    return String(binary % 10 ** digits).padStart(digits, '0');
  }

  public verifyTotp(secret: string, code: string, at: Date): boolean {
    if (!/^[0-9]{6}$/.test(code)) {
      return false;
    }

    for (let window = -1; window <= 1; window += 1) {
      const candidate = this.totp(secret, new Date(at.getTime() + window * periodSeconds * 1_000));

      if (equalText(candidate, code)) {
        return true;
      }
    }

    return false;
  }

  public generateRecoveryCodes(count: number): readonly string[] {
    if (!Number.isInteger(count) || count < 1 || count > 20) {
      throw new RangeError('Recovery code count is invalid.');
    }

    const result = new Set<string>();

    while (result.size < count) {
      const raw = base32Encode(randomBytes(8)).slice(0, 12);

      result.add([raw.slice(0, 4), raw.slice(4, 8), raw.slice(8, 12)].join('-'));
    }

    return Object.freeze([...result]);
  }

  public hashRecoveryCode(code: string): string {
    return createHmac('sha256', this.#recoveryKey)
      .update('arena-core:mfa-recovery-code:v1\0', 'utf8')
      .update(normalizeRecoveryCode(code), 'utf8')
      .digest('hex');
  }
}
