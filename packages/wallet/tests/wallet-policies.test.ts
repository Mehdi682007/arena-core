import { describe, expect, it } from 'vitest';
import {
  requestFingerprint,
  validateIdempotencyKey,
  validateReason,
} from '../src/domain/wallet-policies';

describe('wallet request policies', () => {
  it('has a stable canonical fingerprint independent of object key order', () => {
    expect(
      requestFingerprint({
        operation: 'ISSUANCE',
        userId: 'u',
        amount: 2n,
        direction: 'CREDIT',
        reasonCode: 'FOUNDATION_TEST',
      }),
    ).toBe(
      requestFingerprint({
        direction: 'CREDIT',
        amount: 2n,
        userId: 'u',
        reasonCode: 'FOUNDATION_TEST',
        operation: 'ISSUANCE',
      }),
    );
  });
  it.each(['short', 'contains space', 'x'.repeat(129)])('rejects idempotency key %j', (key) => {
    expect(() => {
      validateIdempotencyKey(key);
    }).toThrow();
  });
  it('bounds administrative notes', () => {
    expect(() => {
      validateReason('OTHER');
    }).toThrow();
    expect(() => {
      validateReason('FOUNDATION_TEST', 'controlled test grant');
    }).not.toThrow();
    expect(() => {
      validateReason('OTHER', 'x'.repeat(501));
    }).toThrow();
  });
});
