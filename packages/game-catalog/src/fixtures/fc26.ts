import { CatalogError } from '../domain/catalog-errors';
import { assertRulesetConfig } from '../domain/catalog-policies';
import type { GameRulesetValidator } from '../domain/ruleset-validator';

export const FC26_GAME_KEY = 'ea_sports_fc_26';

export interface Fc26RulesetConfiguration {
  schemaVersion: 1;
  settings: {
    gameplayPreset: 'COMPETITIVE';
    halfLengthMinutes: number;
    extraTime: boolean;
    penalties: boolean;
    customSquadsAllowed: boolean;
  };
}

export class Fc26RulesetValidator implements GameRulesetValidator {
  public validate(configuration: unknown): void {
    assertRulesetConfig(configuration);
    const candidate = configuration as Partial<Fc26RulesetConfiguration>;
    const settings = candidate.settings as Partial<Fc26RulesetConfiguration['settings']>;
    if (
      candidate.schemaVersion !== 1 ||
      settings.gameplayPreset !== 'COMPETITIVE' ||
      !Number.isSafeInteger(settings.halfLengthMinutes) ||
      Number(settings.halfLengthMinutes) < 3 ||
      Number(settings.halfLengthMinutes) > 20 ||
      typeof settings.extraTime !== 'boolean' ||
      typeof settings.penalties !== 'boolean' ||
      typeof settings.customSquadsAllowed !== 'boolean' ||
      Object.keys(settings).sort().join(',') !==
        'customSquadsAllowed,extraTime,gameplayPreset,halfLengthMinutes,penalties'
    )
      throw new CatalogError('INVALID_RULESET_CONFIG');
  }
}

const arenaCoreConfiguration: Fc26RulesetConfiguration = {
  schemaVersion: 1,
  settings: {
    gameplayPreset: 'COMPETITIVE',
    halfLengthMinutes: 6,
    extraTime: true,
    penalties: true,
    customSquadsAllowed: false,
  },
};

export const FC26_CATALOG_FIXTURE = {
  fixtureVersion: 1,
  game: {
    key: FC26_GAME_KEY,
    slug: 'fc-26',
    name: 'EA SPORTS FC 26',
    shortName: 'FC 26',
    description: 'EA SPORTS FC 26 competitive catalog entry.',
    status: 'ACTIVE',
    isVisible: true,
    sortOrder: 10,
  },
  platforms: [
    {
      key: 'playstation_5',
      slug: 'playstation-5',
      name: 'PlayStation 5',
      family: 'PLAYSTATION',
      externalLabel: 'PlayStation 5',
    },
    {
      key: 'xbox_series_x_s',
      slug: 'xbox-series-x-s',
      name: 'Xbox Series X|S',
      family: 'XBOX',
      externalLabel: 'Xbox Series X|S',
    },
    { key: 'pc', slug: 'pc', name: 'PC', family: 'PC', externalLabel: 'PC' },
    {
      key: 'playstation_4',
      slug: 'playstation-4',
      name: 'PlayStation 4',
      family: 'PLAYSTATION',
      externalLabel: 'PlayStation 4',
    },
    {
      key: 'xbox_one',
      slug: 'xbox-one',
      name: 'Xbox One',
      family: 'XBOX',
      externalLabel: 'Xbox One',
    },
    {
      key: 'nintendo_switch_2',
      slug: 'nintendo-switch-2',
      name: 'Nintendo Switch 2',
      family: 'NINTENDO',
      externalLabel: 'Nintendo Switch 2',
    },
    {
      key: 'nintendo_switch',
      slug: 'nintendo-switch',
      name: 'Nintendo Switch',
      family: 'NINTENDO',
      externalLabel: 'Nintendo Switch',
    },
  ],
  defaultPlatformKey: 'pc',
  crossplayGroups: [
    {
      key: 'current_generation',
      name: 'Current generation cross-play',
      platformKeys: ['playstation_5', 'xbox_series_x_s', 'pc'],
    },
    {
      key: 'previous_generation',
      name: 'Previous generation cross-play',
      platformKeys: ['playstation_4', 'xbox_one'],
    },
    {
      key: 'nintendo_switch_2_isolated',
      name: 'Nintendo Switch 2 isolated pool',
      platformKeys: ['nintendo_switch_2'],
    },
    {
      key: 'nintendo_switch_isolated',
      name: 'Nintendo Switch isolated pool',
      platformKeys: ['nintendo_switch'],
    },
  ],
  modes: [
    {
      key: 'one_v_one',
      slug: 'one-v-one',
      name: '1v1',
      teamSize: 1,
      participantCount: 2,
      sortOrder: 10,
    },
    {
      key: 'two_v_two',
      slug: 'two-v-two',
      name: '2v2',
      teamSize: 2,
      participantCount: 4,
      sortOrder: 20,
    },
  ],
  rulesets: [
    {
      key: 'arena_core_one_v_one',
      modeKey: 'one_v_one',
      version: 1,
      name: 'Arena Core 1v1',
      configuration: arenaCoreConfiguration,
    },
    {
      key: 'arena_core_two_v_two',
      modeKey: 'two_v_two',
      version: 1,
      name: 'Arena Core 2v2',
      configuration: arenaCoreConfiguration,
    },
  ],
} as const;

export function validateFc26Fixture(): void {
  const validator = new Fc26RulesetValidator();
  if (new Set(FC26_CATALOG_FIXTURE.platforms.map(({ key }) => key)).size !== 7)
    throw new CatalogError('INVALID_CATALOG_VALUE');
  const assigned = FC26_CATALOG_FIXTURE.crossplayGroups.flatMap(({ platformKeys }) => platformKeys);
  if (
    assigned.length !== 7 ||
    new Set(assigned).size !== 7 ||
    assigned.some((key) => !FC26_CATALOG_FIXTURE.platforms.some((platform) => platform.key === key))
  )
    throw new CatalogError('INVALID_CATALOG_VALUE');
  for (const ruleset of FC26_CATALOG_FIXTURE.rulesets) validator.validate(ruleset.configuration);
}
