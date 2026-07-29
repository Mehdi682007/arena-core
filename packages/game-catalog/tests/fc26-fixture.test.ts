import { describe, expect, it } from 'vitest';
import {
  CatalogError,
  FC26_CATALOG_FIXTURE,
  Fc26RulesetValidator,
  validateFc26Fixture,
} from '../src';

describe('FC 26 fixture', () => {
  it('contains seven uniquely assigned official platforms', () => {
    expect(() => validateFc26Fixture()).not.toThrow();
    expect(FC26_CATALOG_FIXTURE.platforms).toHaveLength(7);
    expect(
      FC26_CATALOG_FIXTURE.crossplayGroups.flatMap((group) => group.platformKeys),
    ).toHaveLength(7);
  });

  it('contains the Arena Core 1v1 and 2v2 modes and initial rulesets', () => {
    expect(FC26_CATALOG_FIXTURE.modes.map(({ key }) => key)).toEqual(['one_v_one', 'two_v_two']);
    expect(FC26_CATALOG_FIXTURE.rulesets).toHaveLength(2);
  });
});

describe('FC 26 ruleset validator', () => {
  const validator = new Fc26RulesetValidator();

  it('accepts the seeded Arena Core configurations', () => {
    for (const ruleset of FC26_CATALOG_FIXTURE.rulesets)
      expect(() => validator.validate(ruleset.configuration)).not.toThrow();
  });

  it('rejects unsupported presets and unknown settings', () => {
    expect(() =>
      validator.validate({
        schemaVersion: 1,
        settings: {
          gameplayPreset: 'AUTHENTIC',
          halfLengthMinutes: 6,
          extraTime: true,
          penalties: true,
          customSquadsAllowed: false,
          hiddenOverride: true,
        },
      }),
    ).toThrowError(CatalogError);
  });
});
