import { describe, expect, it } from 'vitest';
import {
  deriveOutcome,
  MatchResultError,
  sameCanonicalResult,
  validateAndCanonicalizeResult,
  validateResolutionInput,
  type MatchRecord,
} from '../src';
import { buildSnapshots } from '../src/domain/match-snapshot';
import { context } from './fixtures';

const snapshots = buildSnapshots({
  ...context,
  ruleset: {
    ...context.ruleset,
    configuration: { settings: { drawAllowed: false, extraTime: true, penalties: true } },
  },
});
const match = {
  id: 'match',
  rulesetSnapshot: snapshots.ruleset,
  participants: [
    { id: 'pa', side: 'SIDE_A' },
    { id: 'pb', side: 'SIDE_B' },
  ],
} as unknown as MatchRecord;
const payload = (a: unknown, b: unknown, extra: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  type: 'SCORE',
  scores: [
    { side: 'SIDE_B', score: b },
    { side: 'SIDE_A', score: a },
  ],
  ...extra,
});

describe('match result canonical payload', () => {
  it('canonicalizes ordering and derives SIDE_A winner', () => {
    const value = validateAndCanonicalizeResult(payload(3, 1), match);
    expect(value.scores).toEqual([
      { side: 'SIDE_A', score: 3 },
      { side: 'SIDE_B', score: 1 },
    ]);
    expect(value.outcome).toBe('WIN_LOSS');
    expect(deriveOutcome(value, match)).toEqual({
      winnerParticipantId: 'pa',
      loserParticipantId: 'pb',
      isDraw: false,
    });
  });
  it('derives SIDE_B winner', () => {
    expect(deriveOutcome(validateAndCanonicalizeResult(payload(0, 2), match), match)).toMatchObject(
      {
        winnerParticipantId: 'pb',
      },
    );
  });
  it('rejects draw from ruleset snapshot', () => {
    expect(() => validateAndCanonicalizeResult(payload(2, 2), match)).toThrow(MatchResultError);
  });
  it.each([
    [payload(-1, 2)],
    [payload(1.5, 2)],
    [payload(100, 2)],
    [{ ...payload(1, 2), schemaVersion: 2 }],
    [{ ...payload(1, 2), type: 'WINNER' }],
    [{ ...payload(1, 2), winnerParticipantId: 'pa' }],
    [
      {
        ...payload(1, 2),
        scores: [
          { side: 'SIDE_A', score: 1 },
          { side: 'SIDE_A', score: 2 },
        ],
      },
    ],
  ])('rejects invalid or privileged payload %#', (value) => {
    expect(() => validateAndCanonicalizeResult(value, match)).toThrow(MatchResultError);
  });
  it('compares canonical payload deterministically', () => {
    const left = validateAndCanonicalizeResult(payload(4, 2), match);
    const right = validateAndCanonicalizeResult(
      {
        schemaVersion: 1,
        type: 'SCORE',
        scores: [
          { side: 'SIDE_A', score: 4 },
          { side: 'SIDE_B', score: 2 },
        ],
      },
      match,
    );
    expect(sameCanonicalResult(left, right)).toBe(true);
  });
  it('validates admin reason and OTHER note', () => {
    expect(() => {
      validateResolutionInput('OTHER');
    }).toThrow(MatchResultError);
    expect(() => {
      validateResolutionInput('OTHER', 'reviewed');
    }).not.toThrow();
  });
});
