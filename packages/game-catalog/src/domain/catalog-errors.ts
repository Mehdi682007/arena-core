export type CatalogErrorCode =
  | 'GAME_CATALOG_UNAVAILABLE'
  | 'CATALOG_NOT_FOUND'
  | 'CATALOG_CONFLICT'
  | 'INVALID_CATALOG_KEY'
  | 'INVALID_GAME_SLUG'
  | 'INVALID_CATALOG_VALUE'
  | 'INVALID_STATUS_TRANSITION'
  | 'RULESET_IMMUTABLE'
  | 'INVALID_RULESET_CONFIG';

const messages: Record<CatalogErrorCode, string> = {
  GAME_CATALOG_UNAVAILABLE: 'Game catalog is temporarily unavailable.',
  CATALOG_NOT_FOUND: 'Catalog resource was not found.',
  CATALOG_CONFLICT: 'Catalog resource conflicts with existing data.',
  INVALID_CATALOG_KEY: 'Catalog key is invalid.',
  INVALID_GAME_SLUG: 'Game slug is invalid.',
  INVALID_CATALOG_VALUE: 'Catalog value is invalid.',
  INVALID_STATUS_TRANSITION: 'Catalog status transition is not allowed.',
  RULESET_IMMUTABLE: 'Published rulesets are immutable.',
  INVALID_RULESET_CONFIG: 'Ruleset configuration is invalid.',
};

export class CatalogError extends Error {
  public constructor(public readonly code: CatalogErrorCode) {
    super(messages[code]);
    this.name = 'CatalogError';
  }
}
