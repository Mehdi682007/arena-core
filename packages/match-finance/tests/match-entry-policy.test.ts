import { describe, expect, it } from 'vitest';
import { MatchFinanceError, parseRequirement, reservationFingerprint } from '../src';

describe('match entry requirement', () => {
  it('defaults a missing requirement to a non-required zero snapshot', () => {
    expect(parseRequirement({})).toEqual({
      schemaVersion: 1,
      assetCode: 'ARENA_POINT',
      amountPerParticipant: '0',
      required: false,
    });
  });
  it('accepts a strict ARENA_POINT requirement', () => {
    expect(
      parseRequirement({
        entryRequirement: {
          assetCode: 'ARENA_POINT',
          amountPerParticipant: '100',
          required: true,
        },
      }),
    ).toMatchObject({ amountPerParticipant: '100', required: true });
  });
  it.each([
    { assetCode: 'USD', amountPerParticipant: '10', required: true },
    { assetCode: 'ARENA_POINT', amountPerParticipant: '-1', required: true },
    { assetCode: 'ARENA_POINT', amountPerParticipant: '1.5', required: true },
    { assetCode: 'ARENA_POINT', amountPerParticipant: '0', required: true },
    { assetCode: 'ARENA_POINT', amountPerParticipant: '1', required: false },
  ])('rejects malformed requirement %#', (entryRequirement) => {
    expect(() => parseRequirement({ entryRequirement })).toThrow(MatchFinanceError);
  });
  it('produces a deterministic fingerprint bound to participant and amount', () => {
    const input = {
      matchId: 'match',
      participantId: 'participant',
      userId: 'user',
      assetCode: 'ARENA_POINT' as const,
      amount: 100n,
      operation: 'RESERVE' as const,
    };
    expect(reservationFingerprint(input)).toBe(reservationFingerprint(input));
    expect(reservationFingerprint(input)).not.toBe(
      reservationFingerprint({ ...input, amount: 101n }),
    );
  });
});
