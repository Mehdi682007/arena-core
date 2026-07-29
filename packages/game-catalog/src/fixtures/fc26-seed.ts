import { type ArenaPrismaClient, Prisma } from '@arena-core/database';
import { FC26_CATALOG_FIXTURE, validateFc26Fixture } from './fc26';

export class Fc26SeedDriftError extends Error {
  public constructor(public readonly rulesetKey: string) {
    super(`Active FC 26 ruleset drift detected: ${rulesetKey}`);
    this.name = 'Fc26SeedDriftError';
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function requiredMapValue(map: ReadonlyMap<string, string>, key: string): string {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Validated FC 26 fixture reference missing: ${key}`);
  return value;
}

export function decideFc26RulesetSeedAction(
  existing: { status: string; configuration: unknown } | null,
  expectedConfiguration: unknown,
  rulesetKey: string,
): 'CREATE' | 'REUSE' {
  if (existing === null) return 'CREATE';
  if (
    existing.status !== 'ACTIVE' ||
    canonicalJson(existing.configuration) !== canonicalJson(expectedConfiguration)
  )
    throw new Fc26SeedDriftError(rulesetKey);
  return 'REUSE';
}

export async function seedFc26Catalog(client: ArenaPrismaClient): Promise<void> {
  validateFc26Fixture();
  const fixture = FC26_CATALOG_FIXTURE;
  await client.$transaction(async (tx) => {
    const game = await tx.game.upsert({
      where: { key: fixture.game.key },
      create: fixture.game,
      update: fixture.game,
    });
    const gamePlatforms = new Map<string, string>();
    for (const [index, platformFixture] of fixture.platforms.entries()) {
      const { externalLabel, ...platformData } = platformFixture;
      const platform = await tx.platform.upsert({
        where: { key: platformData.key },
        create: { ...platformData, status: 'ACTIVE', sortOrder: (index + 1) * 10 },
        update: { ...platformData, status: 'ACTIVE', sortOrder: (index + 1) * 10 },
      });
      const gamePlatform = await tx.gamePlatform.upsert({
        where: { gameId_platformId: { gameId: game.id, platformId: platform.id } },
        create: {
          gameId: game.id,
          platformId: platform.id,
          status: 'ACTIVE',
          isDefault: platformData.key === fixture.defaultPlatformKey,
          externalLabel,
          sortOrder: (index + 1) * 10,
        },
        update: {
          status: 'ACTIVE',
          isDefault: platformData.key === fixture.defaultPlatformKey,
          externalLabel,
          sortOrder: (index + 1) * 10,
          archivedAt: null,
        },
      });
      gamePlatforms.set(platformData.key, gamePlatform.id);
    }

    for (const [index, groupFixture] of fixture.crossplayGroups.entries()) {
      const group = await tx.crossplayGroup.upsert({
        where: { gameId_key: { gameId: game.id, key: groupFixture.key } },
        create: {
          gameId: game.id,
          key: groupFixture.key,
          name: groupFixture.name,
          status: 'ACTIVE',
          sortOrder: (index + 1) * 10,
        },
        update: {
          name: groupFixture.name,
          status: 'ACTIVE',
          sortOrder: (index + 1) * 10,
          archivedAt: null,
        },
      });
      await tx.crossplayGroupPlatform.deleteMany({ where: { crossplayGroupId: group.id } });
      await tx.crossplayGroupPlatform.createMany({
        data: groupFixture.platformKeys.map((platformKey) => ({
          gameId: game.id,
          crossplayGroupId: group.id,
          gamePlatformId: requiredMapValue(gamePlatforms, platformKey),
        })),
      });
    }

    const modes = new Map<string, string>();
    for (const modeFixture of fixture.modes) {
      const mode = await tx.gameMode.upsert({
        where: { gameId_key: { gameId: game.id, key: modeFixture.key } },
        create: {
          gameId: game.id,
          key: modeFixture.key,
          slug: modeFixture.slug,
          name: modeFixture.name,
          status: 'ACTIVE',
          teamSizeMin: modeFixture.teamSize,
          teamSizeMax: modeFixture.teamSize,
          participantCountMin: modeFixture.participantCount,
          participantCountMax: modeFixture.participantCount,
          sortOrder: modeFixture.sortOrder,
        },
        update: {
          slug: modeFixture.slug,
          name: modeFixture.name,
          status: 'ACTIVE',
          teamSizeMin: modeFixture.teamSize,
          teamSizeMax: modeFixture.teamSize,
          participantCountMin: modeFixture.participantCount,
          participantCountMax: modeFixture.participantCount,
          sortOrder: modeFixture.sortOrder,
          archivedAt: null,
        },
      });
      modes.set(modeFixture.key, mode.id);
    }

    for (const ruleset of fixture.rulesets) {
      const existing = await tx.gameRuleset.findUnique({
        where: {
          gameId_key_version: {
            gameId: game.id,
            key: ruleset.key,
            version: ruleset.version,
          },
        },
      });
      if (decideFc26RulesetSeedAction(existing, ruleset.configuration, ruleset.key) === 'REUSE')
        continue;
      await tx.gameRuleset.create({
        data: {
          gameId: game.id,
          gameModeId: requiredMapValue(modes, ruleset.modeKey),
          key: ruleset.key,
          version: ruleset.version,
          name: ruleset.name,
          description: 'Arena Core house rules for FC 26 competition.',
          status: 'ACTIVE',
          isDefault: true,
          configuration: ruleset.configuration as unknown as Prisma.InputJsonValue,
          publishedAt: new Date(),
        },
      });
    }
  });
}
