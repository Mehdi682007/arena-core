import { describe, expect, it } from 'vitest';
import {
  assertMatchTransition,
  buildSnapshots,
  envelope,
  MatchError,
  validateMatchSnapshot,
  validateVoidInput,
} from '../src';
import { context } from './fixtures';
describe('match snapshot safety', () => {
  it('builds deterministic immutable versioned snapshots', () => {
    const first = buildSnapshots(context);
    const second = buildSnapshots(context);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.ruleset.data.configuration).toEqual({ halves: 6 });
    expect(Object.isFrozen(first.game)).toBe(true);
    expect(first.participants).toHaveLength(2);
  });
  it.each([
    { schemaVersion: 2, data: {} },
    { schemaVersion: 1, data: { accessToken: 'secret' } },
    { schemaVersion: 1, data: { email: 'x@example.test' } },
    { schemaVersion: 1, data: { normalizedHandle: 'hidden' } },
  ])('rejects unsafe snapshot %#', (value) => {
    expect(() => {
      validateMatchSnapshot(value);
    }).toThrow(MatchError);
  });
  it('rejects deep and oversized snapshots', () => {
    let deep: unknown = 'x';
    for (let index = 0; index < 10; index += 1) deep = { child: deep };
    expect(() => envelope(deep)).toThrow(MatchError);
    expect(() => envelope({ value: 'x'.repeat(17_000) })).toThrow(MatchError);
  });
  it('rejects duplicate users, unverified account, unmatched request and archived ruleset', () => {
    expect(() =>
      buildSnapshots({
        ...context,
        participants: [context.participants[0], { ...context.participants[1], userId: 'user-a' }],
      }),
    ).toThrow(MatchError);
    expect(() =>
      buildSnapshots({
        ...context,
        participants: [
          { ...context.participants[0], accountVerified: false },
          context.participants[1],
        ],
      }),
    ).toThrow(MatchError);
    expect(() =>
      buildSnapshots({ ...context, ruleset: { ...context.ruleset, status: 'ARCHIVED' } }),
    ).toThrow(MatchError);
  });
});
describe('match lifecycle policy', () => {
  it.each([
    ['CREATED', 'AWAITING_READY'],
    ['AWAITING_READY', 'READY'],
    ['AWAITING_READY', 'CANCELLED'],
    ['AWAITING_READY', 'EXPIRED'],
    ['READY', 'VOIDED'],
  ] as const)('allows %s to %s', (from, to) => {
    expect(() => {
      assertMatchTransition(from, to);
    }).not.toThrow();
  });
  it.each([
    ['READY', 'CANCELLED'],
    ['EXPIRED', 'READY'],
    ['VOIDED', 'AWAITING_READY'],
  ] as const)('rejects %s to %s', (from, to) => {
    expect(() => {
      assertMatchTransition(from, to);
    }).toThrow(MatchError);
  });
  it('requires a note for OTHER admin void and bounds notes', () => {
    expect(() => {
      validateVoidInput({ reasonCode: 'OTHER' });
    }).toThrow(MatchError);
    expect(() => {
      validateVoidInput({ reasonCode: 'OPERATIONAL_ERROR' });
    }).not.toThrow();
  });
});
