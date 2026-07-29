import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve('prisma/migrations/20260725120000_create_game_catalog/migration.sql'),
  'utf8',
);
describe('F3.1 catalog persistence contract', () => {
  it.each([
    'Game',
    'Platform',
    'GamePlatform',
    'CrossplayGroup',
    'CrossplayGroupPlatform',
    'GameMode',
    'GameRuleset',
  ])('defines %s', (model) => {
    expect(schema).toContain(`model ${model} {`);
  });
  it('keeps the migration real and includes integrity enforcement', () => {
    expect(migration.length).toBeGreaterThan(8_000);
    expect(migration).toContain('game_platforms_one_default_per_game_key');
    expect(migration).toContain('game_rulesets_one_default_per_mode_key');
    expect(migration).toContain('crossplay_group_platforms_platform_game_fkey');
    expect(migration).toContain('game_rulesets_configuration_check');
  });
  it('does not mutate the identity migration', () => {
    expect(migration).not.toContain('CREATE TABLE "users"');
  });
});
