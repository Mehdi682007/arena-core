import {
  argon2,
  createHmac,
  randomBytes,
  timingSafeEqual,
  type Argon2Parameters,
} from 'node:crypto';
import type { AuthenticationConfig } from '@arena-core/config';
import type { TokenKind } from '../domain/identity-types';
import type { Clock, PasswordHasher, PasswordHashResult, TokenService } from '../ports/crypto';

const argonVersion = 19;
const tagLength = 32;
const saltLength = 16;

function derive(parameters: Argon2Parameters): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2('argon2id', parameters, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function base64Url(value: Buffer): string {
  return value.toString('base64url');
}

interface ParsedHash {
  memory: number;
  iterations: number;
  parallelism: number;
  salt: Buffer;
  digest: Buffer;
}

function parseEncodedHash(encoded: string): ParsedHash | null {
  const match =
    /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/.exec(encoded);
  if (!match) return null;
  const salt = Buffer.from(match[4] ?? '', 'base64url');
  const digest = Buffer.from(match[5] ?? '', 'base64url');
  if (salt.length < 16 || digest.length !== tagLength) return null;
  return {
    memory: Number(match[1]),
    iterations: Number(match[2]),
    parallelism: Number(match[3]),
    salt,
    digest,
  };
}

export class NodeArgon2PasswordHasher implements PasswordHasher {
  public constructor(private readonly config: AuthenticationConfig['password']) {}

  public async hash(password: string): Promise<PasswordHashResult> {
    const salt = randomBytes(saltLength);
    const digest = await derive({
      message: Buffer.from(password, 'utf8'),
      nonce: salt,
      parallelism: this.config.parallelism,
      tagLength,
      memory: this.config.memoryKiB,
      passes: this.config.iterations,
    });
    return Object.freeze({
      algorithm: 'argon2id',
      encodedHash: `$argon2id$v=${String(argonVersion)}$m=${String(
        this.config.memoryKiB,
      )},t=${String(this.config.iterations)},p=${String(this.config.parallelism)}$${base64Url(
        salt,
      )}$${base64Url(digest)}`,
    });
  }

  public async verify(password: string, encodedHash: string): Promise<boolean> {
    const parsed = parseEncodedHash(encodedHash);
    if (parsed === null) return false;
    try {
      const actual = await derive({
        message: Buffer.from(password, 'utf8'),
        nonce: parsed.salt,
        parallelism: parsed.parallelism,
        tagLength: parsed.digest.length,
        memory: parsed.memory,
        passes: parsed.iterations,
      });
      return actual.length === parsed.digest.length && timingSafeEqual(actual, parsed.digest);
    } catch {
      return false;
    }
  }

  public needsRehash(encodedHash: string): boolean {
    const parsed = parseEncodedHash(encodedHash);
    return (
      parsed === null ||
      parsed.memory !== this.config.memoryKiB ||
      parsed.iterations !== this.config.iterations ||
      parsed.parallelism !== this.config.parallelism
    );
  }
}

export class NodeCryptoTokenService implements TokenService {
  readonly #tokenKey: Buffer;
  readonly #ipKey: Buffer;

  public constructor(config: AuthenticationConfig) {
    this.#tokenKey = Buffer.from(config.tokenHashKey.reveal(), 'utf8');
    this.#ipKey = Buffer.from(config.ipHashKey.reveal(), 'utf8');
  }

  public generateToken(byteLength: number): string {
    return randomBytes(byteLength).toString('base64url');
  }

  public hashToken(type: TokenKind, token: string): string {
    return createHmac('sha256', this.#tokenKey)
      .update(`arena-core:${type}:v1\0`, 'utf8')
      .update(token, 'utf8')
      .digest('hex');
  }

  public hashIp(ip: string): string {
    return createHmac('sha256', this.#ipKey)
      .update('arena-core:ip:v1\0', 'utf8')
      .update(ip, 'utf8')
      .digest('hex');
  }

  public constantTimeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }
}

export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}
