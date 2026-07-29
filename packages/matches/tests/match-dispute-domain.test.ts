import { describe, expect, it } from 'vitest';
import {
  assertDisputeTransition,
  MatchDisputeError,
  MatchEvidenceError,
  buildSnapshots,
  validateClaim,
  validateEvidencePayload,
} from '../src';
import { context } from './fixtures';

const now = new Date('2026-07-26T12:00:00.000Z');
const snapshots = buildSnapshots(context);
const resultContext = {
  match: {
    id: 'match',
    status: 'COMPLETED',
    rulesetSnapshot: snapshots.ruleset,
    participants: [
      { id: 'pa', side: 'SIDE_A' },
      { id: 'pb', side: 'SIDE_B' },
    ],
  },
  submissions: [],
  result: null,
} as never;

describe('F4.4 evidence declarations', () => {
  it('accepts declaration metadata and canonicalizes capturedAt', () => {
    expect(
      validateEvidencePayload(
        {
          schemaVersion: 1,
          type: 'SCREENSHOT_DECLARATION',
          description: ' score screen ',
          capturedAt: '2026-07-26T11:59:00Z',
        },
        now,
      ),
    ).toMatchObject({ description: 'score screen', capturedAt: '2026-07-26T11:59:00.000Z' });
  });
  it.each(['url', 'path', 'binary', 'mimeType', 'checksum', 'storageKey'])(
    'rejects forbidden %s metadata',
    (field) => {
      expect(() =>
        validateEvidencePayload(
          { schemaVersion: 1, type: 'TEXT_STATEMENT', [field]: 'untrusted' },
          now,
        ),
      ).toThrow(MatchEvidenceError);
    },
  );
  it('rejects excessive descriptions and implausibly future capture times', () => {
    expect(() =>
      validateEvidencePayload(
        { schemaVersion: 1, type: 'TEXT_STATEMENT', description: 'x'.repeat(2001) },
        now,
      ),
    ).toThrow(MatchEvidenceError);
    expect(() =>
      validateEvidencePayload(
        { schemaVersion: 1, type: 'TEXT_STATEMENT', capturedAt: '2026-07-26T12:06:00Z' },
        now,
      ),
    ).toThrow(MatchEvidenceError);
  });
});

describe('F4.4 dispute policy', () => {
  it('accepts a bounded claim and rejects privileged result fields', () => {
    expect(
      validateClaim(
        'SCORE_MISMATCH',
        {
          schemaVersion: 1,
          statement: 'The recorded score is incorrect.',
          requestedOutcome: 'KEEP_CURRENT_RESULT',
          evidenceIds: [],
        },
        resultContext,
      ),
    ).toMatchObject({ schemaVersion: 1, requestedOutcome: 'KEEP_CURRENT_RESULT' });
    expect(() =>
      validateClaim(
        'WRONG_WINNER',
        {
          schemaVersion: 1,
          statement: 'Winner should be corrected.',
          requestedOutcome: 'CORRECT_SCORE',
          proposedResult: {
            schemaVersion: 1,
            type: 'SCORE',
            scores: [],
            winnerParticipantId: 'pa',
          },
          evidenceIds: [],
        },
        resultContext,
      ),
    ).toThrow();
  });
  it('requires details for OTHER and enforces transition graph', () => {
    expect(() =>
      validateClaim(
        'OTHER',
        { schemaVersion: 1, statement: 'short', requestedOutcome: 'VOID_MATCH', evidenceIds: [] },
        resultContext,
      ),
    ).toThrow(MatchDisputeError);
    expect(() => {
      assertDisputeTransition('AWAITING_RESPONSE', 'UNDER_REVIEW');
    }).not.toThrow();
    expect(() => {
      assertDisputeTransition('RESOLVED', 'UNDER_REVIEW');
    }).toThrow(MatchDisputeError);
  });
});
