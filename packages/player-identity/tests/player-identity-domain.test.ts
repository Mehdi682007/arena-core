import { describe, expect, it } from 'vitest';
import {
  assertGameAccountTransition,
  assertPrimaryEligible,
  GenericPlatformHandleNormalizer,
  PlayerIdentityError,
  statusForReview,
} from '../src';

describe('platform handle normalization', () => {
  const normalizer = new GenericPlatformHandleNormalizer();
  it.each([
    ['  Player Name  ', 'Player Name', 'player name'],
    ['  بازیکن  ', 'بازیکن', 'بازیکن'],
    ['E\u0301lite', 'Élite', 'élite'],
    ['Goal⚽', 'Goal⚽', 'goal⚽'],
  ])('normalizes %s safely', (input, display, normalized) => {
    expect(normalizer.normalize(input)).toEqual({ display, normalized });
  });
  it.each([' ', 'a', 'a\nb', 'a\u202Eb', 'a\0b', `a${'x'.repeat(65)}`])(
    'rejects unsafe handle %j',
    (input) => expect(() => normalizer.normalize(input)).toThrowError(PlayerIdentityError),
  );
});
describe('account lifecycle policy', () => {
  it.each([
    ['PENDING', 'VERIFIED'],
    ['PENDING', 'REJECTED'],
    ['VERIFIED', 'SUSPENDED'],
    ['SUSPENDED', 'VERIFIED'],
    ['REJECTED', 'PENDING'],
    ['REJECTED', 'DISCONNECTED'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(() => assertGameAccountTransition(from, to)).not.toThrow();
  });
  it.each([
    ['DISCONNECTED', 'PENDING'],
    ['DISCONNECTED', 'VERIFIED'],
    ['PENDING', 'SUSPENDED'],
    ['REJECTED', 'VERIFIED'],
  ] as const)('rejects %s -> %s', (from, to) => {
    expect(() => assertGameAccountTransition(from, to)).toThrowError(PlayerIdentityError);
  });
  it('allows only verified accounts to become primary', () => {
    expect(() => assertPrimaryEligible('VERIFIED')).not.toThrow();
    expect(() => assertPrimaryEligible('PENDING')).toThrowError(PlayerIdentityError);
  });
  it('maps review actions to lifecycle states', () => {
    expect(statusForReview('VERIFY')).toBe('VERIFIED');
    expect(statusForReview('RESTORE')).toBe('VERIFIED');
    expect(statusForReview('DISCONNECT')).toBe('DISCONNECTED');
  });
});
