import { describe, expect, it } from 'vitest';
import {
  assertRequestTransition,
  evaluateCompatibility,
  MatchmakingError,
  validateCriteria,
  type MatchmakingRequest,
} from '../src';

const now = new Date('2026-07-25T12:00:00Z');
const base: MatchmakingRequest = {
  id: 'a',
  userId: 'user-a',
  userGameAccountId: 'account-a',
  gameId: 'game',
  gameModeId: 'mode',
  gameRulesetId: 'ruleset',
  gamePlatformId: 'pc',
  crossplayGroupId: 'current',
  status: 'SEARCHING',
  searchScope: 'CROSSPLAY_GROUP',
  criteria: { schemaVersion: 1, preferences: { language: 'fa', region: 'middle-east' } },
  priority: 0,
  accountVerified: true,
  catalogValid: true,
  createdAt: new Date('2026-07-25T11:00:00Z'),
  expiresAt: new Date('2026-07-25T12:15:00Z'),
  version: 2,
};
describe('matchmaking criteria', () => {
  it('accepts empty and bounded preferences', () => {
    expect(validateCriteria(undefined)).toEqual({ schemaVersion: 1, preferences: {} });
    expect(
      validateCriteria({
        schemaVersion: 1,
        preferences: { language: 'fa', region: 'middle-east' },
      }),
    ).toMatchObject({ preferences: { language: 'fa', region: 'middle-east' } });
  });
  it.each([
    { schemaVersion: 2, preferences: {} },
    { schemaVersion: 1, preferences: { language: 'de' } },
    { schemaVersion: 1, preferences: { region: '../x' } },
    { schemaVersion: 1, preferences: { skill: 10 } },
    { schemaVersion: 1, preferences: { entryFee: 1 } },
  ])('rejects unsafe criteria %#', (criteria) => {
    expect(() => validateCriteria(criteria)).toThrow(MatchmakingError);
  });
});
describe('request lifecycle', () => {
  it.each([
    ['PENDING', 'SEARCHING'],
    ['SEARCHING', 'PROPOSED'],
    ['PROPOSED', 'MATCHED'],
    ['PROPOSED', 'SEARCHING'],
  ] as const)('allows %s to %s', (from, to) => {
    expect(() => {
      assertRequestTransition(from, to);
    }).not.toThrow();
  });
  it.each([
    ['MATCHED', 'SEARCHING'],
    ['CANCELLED', 'SEARCHING'],
    ['EXPIRED', 'PENDING'],
  ] as const)('rejects terminal transition %s to %s', (from, to) => {
    expect(() => {
      assertRequestTransition(from, to);
    }).toThrow(MatchmakingError);
  });
});
describe('compatibility', () => {
  it('is deterministic, bounded, and preference-only scored', () => {
    const right = { ...base, id: 'b', userId: 'user-b', gamePlatformId: 'ps5' };
    expect(evaluateCompatibility(base, right, now)).toEqual({
      compatible: true,
      reasons: [],
      score: 115,
    });
    expect(evaluateCompatibility(base, right, now)).toEqual(
      evaluateCompatibility(base, right, now),
    );
  });
  it.each([
    [{ userId: 'user-a' }, 'SAME_USER'],
    [{ status: 'PENDING' }, 'REQUEST_NOT_SEARCHING'],
    [{ gameId: 'other' }, 'GAME_MISMATCH'],
    [{ gameModeId: 'other' }, 'MODE_MISMATCH'],
    [{ gameRulesetId: 'other' }, 'RULESET_MISMATCH'],
    [{ crossplayGroupId: 'other' }, 'CROSSPLAY_GROUP_MISMATCH'],
    [{ accountVerified: false }, 'ACCOUNT_NOT_VERIFIED'],
    [{ criteria: { schemaVersion: 1, preferences: { language: 'en' } } }, 'LANGUAGE_MISMATCH'],
  ] as const)('reports %s', (change, reason) => {
    const result = evaluateCompatibility(
      base,
      { ...base, id: 'b', userId: 'user-b', ...change },
      now,
    );
    expect(result.compatible).toBe(false);
    expect(result.reasons).toContain(reason);
  });
  it('enforces same platform when either side requests it', () => {
    const result = evaluateCompatibility(
      { ...base, searchScope: 'SAME_PLATFORM' },
      { ...base, id: 'b', userId: 'user-b', gamePlatformId: 'ps5' },
      now,
    );
    expect(result.reasons).toContain('PLATFORM_SCOPE_MISMATCH');
  });
  it('rejects expired requests and active proposals', () => {
    const right = { ...base, id: 'b', userId: 'user-b', expiresAt: now };
    expect(evaluateCompatibility(base, right, now, true).reasons).toEqual(
      expect.arrayContaining(['REQUEST_EXPIRED', 'ACTIVE_PROPOSAL_EXISTS']),
    );
  });
});
