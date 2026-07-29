import { describe, expect, it } from 'vitest';
import {
  CatalogError,
  assertCatalogKey,
  assertGameSlug,
  assertGameStatusTransition,
  assertModeCapacity,
  assertRulesetConfig,
  assertRulesetStatusTransition,
} from '../src';

describe('game catalog domain policies', () => {
  it.each(['fc_26', 'game2', 'a_b'])('accepts stable catalog key %s', (key) => {
    expect(() => assertCatalogKey(key)).not.toThrow();
  });
  it.each(['A', 'a-', '_game', 'a'.repeat(65)])('rejects invalid catalog key %s', (key) => {
    expect(() => assertCatalogKey(key)).toThrowError(CatalogError);
  });
  it('validates slugs and reserved route names', () => {
    expect(() => assertGameSlug('football-2026')).not.toThrow();
    for (const slug of ['admin', 'api', 'UPPER', '-broken'])
      expect(() => assertGameSlug(slug)).toThrowError(CatalogError);
  });
  it('enforces explicit terminal archive transitions', () => {
    expect(() => assertGameStatusTransition('DRAFT', 'ACTIVE')).not.toThrow();
    expect(() => assertGameStatusTransition('ARCHIVED', 'ACTIVE')).toThrowError(
      expect.objectContaining({ code: 'INVALID_STATUS_TRANSITION' }),
    );
  });
  it('enforces the ruleset publication lifecycle', () => {
    expect(() => assertRulesetStatusTransition('DRAFT', 'ACTIVE')).not.toThrow();
    expect(() => assertRulesetStatusTransition('ACTIVE', 'SUPERSEDED')).not.toThrow();
    expect(() => assertRulesetStatusTransition('SUPERSEDED', 'ARCHIVED')).not.toThrow();
    expect(() => assertRulesetStatusTransition('ACTIVE', 'DRAFT')).toThrow();
    expect(() => assertRulesetStatusTransition('ARCHIVED', 'ACTIVE')).toThrow();
  });
  it('validates mode capacity ranges', () => {
    expect(() => assertModeCapacity(1, 5, 2, 10)).not.toThrow();
    expect(() => assertModeCapacity(3, 2, 2, 10)).toThrowError(CatalogError);
  });
  it('accepts bounded JSON-only ruleset configuration', () => {
    expect(() => assertRulesetConfig({ schemaVersion: 1, settings: { rounds: 3 } })).not.toThrow();
  });
  it.each([
    { schemaVersion: 0, settings: {} },
    { schemaVersion: 1, settings: { when: new Date() } },
    { schemaVersion: 1, settings: { amount: Number.NaN } },
    { schemaVersion: 1, settings: { amount: BigInt(1) } },
  ])('rejects unsafe ruleset config', (config) => {
    expect(() => assertRulesetConfig(config)).toThrowError(
      expect.objectContaining({ code: 'INVALID_RULESET_CONFIG' }),
    );
  });
  it('rejects cycles and excessive depth', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => assertRulesetConfig({ schemaVersion: 1, settings: cyclic })).toThrow();
    let deep: Record<string, unknown> = {};
    const root = deep;
    for (let index = 0; index < 14; index += 1) {
      deep.child = {};
      deep = deep.child as Record<string, unknown>;
    }
    expect(() => assertRulesetConfig({ schemaVersion: 1, settings: root })).toThrow();
  });
  it('rejects prototype-pollution keys and oversized JSON', () => {
    const unsafe = JSON.parse('{"schemaVersion":1,"settings":{"constructor":{"x":1}}}');
    expect(() => assertRulesetConfig(unsafe)).toThrow();
    expect(() =>
      assertRulesetConfig({ schemaVersion: 1, settings: { data: 'x'.repeat(70_000) } }),
    ).toThrow();
  });
});
