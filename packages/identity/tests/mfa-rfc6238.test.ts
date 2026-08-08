import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { NodeMfaCrypto } from '../src/infrastructure/node-mfa-crypto';

const rfcSecret = Buffer.from('12345678901234567890', 'ascii');

const rfcSecretBase32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

const vectors = [
  {
    seconds: 59,
    expectedEight: '94287082',
    expectedSix: '287082',
  },
  {
    seconds: 1_111_111_109,
    expectedEight: '07081804',
    expectedSix: '081804',
  },
  {
    seconds: 1_111_111_111,
    expectedEight: '14050471',
    expectedSix: '050471',
  },
  {
    seconds: 1_234_567_890,
    expectedEight: '89005924',
    expectedSix: '005924',
  },
  {
    seconds: 2_000_000_000,
    expectedEight: '69279037',
    expectedSix: '279037',
  },
  {
    seconds: 20_000_000_000,
    expectedEight: '65353130',
    expectedSix: '353130',
  },
] as const;

function referenceTotp(secret: Buffer, seconds: number, digits: number): string {
  const counter = BigInt(Math.floor(seconds / 30));

  const message = Buffer.alloc(8);

  message.writeBigUInt64BE(counter);

  const digest = createHmac('sha1', secret).update(message).digest();

  const lastByte = digest.at(-1);

  if (lastByte === undefined) {
    throw new Error('Unexpected empty HMAC digest.');
  }

  const offset = lastByte & 0x0f;

  const binary = digest.readUInt32BE(offset) & 0x7fffffff;

  return String(binary % 10 ** digits).padStart(digits, '0');
}

describe('RFC 6238 SHA-1 vectors', () => {
  const crypto = new NodeMfaCrypto('arena-core-rfc6238-test-master-key-2026');

  it.each(vectors)(
    'matches RFC vector at $seconds seconds',
    ({ seconds, expectedEight, expectedSix }) => {
      const referenceEight = referenceTotp(rfcSecret, seconds, 8);

      expect(referenceEight).toBe(expectedEight);

      const referenceSix = referenceTotp(rfcSecret, seconds, 6);

      expect(referenceSix).toBe(expectedSix);

      const at = new Date(seconds * 1_000);

      expect(crypto.totp(rfcSecretBase32, at)).toBe(expectedSix);

      expect(crypto.verifyTotp(rfcSecretBase32, expectedSix, at)).toBe(true);
    },
  );

  it('rejects a non-RFC six-digit code outside the accepted window', () => {
    const at = new Date(59 * 1_000);

    expect(crypto.verifyTotp(rfcSecretBase32, '000000', at)).toBe(false);
  });
});
