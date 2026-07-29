import { CatalogError } from './catalog-errors';
import type { GameRulesetStatus, GameStatus, RulesetConfig } from './catalog-types';

const reservedSlugs = new Set([
  'admin',
  'api',
  'auth',
  'profile',
  'onboarding',
  'health',
  'new',
  'edit',
]);
const transitions: Readonly<Record<GameStatus, readonly GameStatus[]>> = {
  DRAFT: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['INACTIVE', 'ARCHIVED'],
  INACTIVE: ['ACTIVE', 'ARCHIVED'],
  ARCHIVED: [],
};
const rulesetTransitions: Readonly<Record<GameRulesetStatus, readonly GameRulesetStatus[]>> = {
  DRAFT: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['SUPERSEDED', 'ARCHIVED'],
  SUPERSEDED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function assertCatalogKey(value: string): void {
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(value)) throw new CatalogError('INVALID_CATALOG_KEY');
}
export function assertGameSlug(value: string): void {
  if (
    value.length < 2 ||
    value.length > 80 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ||
    reservedSlugs.has(value)
  )
    throw new CatalogError('INVALID_GAME_SLUG');
}
export function assertName(value: string, maximum = 120): void {
  if (value.trim().length === 0 || value.trim().length > maximum)
    throw new CatalogError('INVALID_CATALOG_VALUE');
}
export function assertSortOrder(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new CatalogError('INVALID_CATALOG_VALUE');
}
export function assertGameStatusTransition(from: GameStatus, to: GameStatus): void {
  if (from !== to && !transitions[from].includes(to))
    throw new CatalogError('INVALID_STATUS_TRANSITION');
}
export function assertRulesetStatusTransition(
  from: GameRulesetStatus,
  to: GameRulesetStatus,
): void {
  if (from !== to && !rulesetTransitions[from].includes(to))
    throw new CatalogError('INVALID_STATUS_TRANSITION');
}
export function assertModeCapacity(
  minTeamSize: number,
  maxTeamSize: number,
  minParticipants: number,
  maxParticipants: number,
): void {
  if (
    ![minTeamSize, maxTeamSize, minParticipants, maxParticipants].every(Number.isSafeInteger) ||
    minTeamSize < 1 ||
    maxTeamSize < minTeamSize ||
    minParticipants < 1 ||
    maxParticipants < minParticipants
  )
    throw new CatalogError('INVALID_CATALOG_VALUE');
}

const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor']);
export function assertRulesetConfig(value: unknown): asserts value is RulesetConfig {
  const seen = new Set<object>();
  let nodes = 0;
  const visit = (item: unknown, depth: number): void => {
    nodes += 1;
    if (depth > 12 || nodes > 2_000) throw new CatalogError('INVALID_RULESET_CONFIG');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new CatalogError('INVALID_RULESET_CONFIG');
      return;
    }
    if (typeof item !== 'object' || item instanceof Date)
      throw new CatalogError('INVALID_RULESET_CONFIG');
    if (seen.has(item)) throw new CatalogError('INVALID_RULESET_CONFIG');
    seen.add(item);
    if (Array.isArray(item)) {
      for (const child of item) visit(child, depth + 1);
    } else {
      const prototype = Object.getPrototypeOf(item) as unknown;
      if (prototype !== Object.prototype && prototype !== null)
        throw new CatalogError('INVALID_RULESET_CONFIG');
      for (const [key, child] of Object.entries(item)) {
        if (dangerousKeys.has(key)) throw new CatalogError('INVALID_RULESET_CONFIG');
        visit(child, depth + 1);
      }
    }
    seen.delete(item);
  };
  visit(value, 0);
  const candidate = value as Partial<RulesetConfig>;
  if (
    !Number.isSafeInteger(candidate.schemaVersion) ||
    Number(candidate.schemaVersion) < 1 ||
    typeof candidate.settings !== 'object' ||
    Array.isArray(candidate.settings) ||
    JSON.stringify(value).length > 65_536
  )
    throw new CatalogError('INVALID_RULESET_CONFIG');
}
