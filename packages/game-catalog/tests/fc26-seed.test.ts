import { describe, expect, it } from 'vitest';
import { decideFc26RulesetSeedAction, FC26_CATALOG_FIXTURE, Fc26SeedDriftError } from '../src';

const expected = FC26_CATALOG_FIXTURE.rulesets[0].configuration;

describe('FC 26 ruleset seed reconciliation', () => {
  it('creates a missing ruleset and reuses an identical active ruleset on repeat', () => {
    expect(decideFc26RulesetSeedAction(null, expected, 'arena_core_one_v_one')).toBe('CREATE');
    expect(
      decideFc26RulesetSeedAction(
        { status: 'ACTIVE', configuration: structuredClone(expected) },
        expected,
        'arena_core_one_v_one',
      ),
    ).toBe('REUSE');
  });

  it('detects active configuration drift without overwriting it', () => {
    const drifted = structuredClone(expected);
    drifted.settings.halfLengthMinutes = 7;
    expect(() =>
      decideFc26RulesetSeedAction(
        { status: 'ACTIVE', configuration: drifted },
        expected,
        'arena_core_one_v_one',
      ),
    ).toThrowError(Fc26SeedDriftError);
  });

  it('refuses to silently reactivate an existing non-active version', () => {
    expect(() =>
      decideFc26RulesetSeedAction(
        { status: 'SUPERSEDED', configuration: expected },
        expected,
        'arena_core_one_v_one',
      ),
    ).toThrowError(Fc26SeedDriftError);
  });
});
