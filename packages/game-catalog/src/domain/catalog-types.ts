export type GameStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type CatalogStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type GameModeStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type GameRulesetStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED';
export type PlatformFamily = 'PLAYSTATION' | 'XBOX' | 'PC' | 'NINTENDO' | 'MOBILE' | 'OTHER';

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface RulesetConfig {
  readonly schemaVersion: number;
  readonly settings: Readonly<Record<string, JsonValue>>;
}

export interface PublicPlatform {
  readonly id: string;
  readonly gamePlatformId: string;
  readonly key: string;
  readonly slug: string;
  readonly name: string;
  readonly family: PlatformFamily;
  readonly isDefault: boolean;
}
export interface PublicGameMode {
  readonly id: string;
  readonly key: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly teamSizeMin: number;
  readonly teamSizeMax: number;
  readonly participantCountMin: number;
  readonly participantCountMax: number;
}
export interface PublicGameSummary {
  readonly id: string;
  readonly key: string;
  readonly slug: string;
  readonly name: string;
  readonly shortName: string | null;
  readonly description: string | null;
  readonly platforms: readonly PublicPlatform[];
}
export interface PublicGame extends PublicGameSummary {
  readonly modes: readonly PublicGameMode[];
}
export interface PublicRuleset {
  readonly id: string;
  readonly key: string;
  readonly version: number;
  readonly name: string;
  readonly gameModeId: string;
  readonly configuration: RulesetConfig;
  readonly publishedAt: Date;
}

export interface CreateGameInput {
  readonly key: string;
  readonly slug: string;
  readonly name: string;
  readonly shortName?: string | null;
  readonly description?: string | null;
  readonly isVisible?: boolean;
  readonly sortOrder?: number;
}
export interface UpdateGameInput {
  readonly id: string;
  readonly name?: string;
  readonly shortName?: string;
  readonly description?: string | null;
  readonly isVisible?: boolean;
  readonly sortOrder?: number;
  readonly status?: GameStatus;
}
export interface CreatePlatformInput {
  readonly key: string;
  readonly name: string;
  readonly family: PlatformFamily;
  readonly slug: string;
  readonly sortOrder?: number;
}
export interface AttachPlatformInput {
  readonly gameId: string;
  readonly platformId: string;
  readonly isDefault?: boolean;
  readonly externalLabel?: string | null;
  readonly sortOrder?: number;
}
export interface CreateGameModeInput {
  readonly gameId: string;
  readonly key: string;
  readonly slug: string;
  readonly name: string;
  readonly description?: string | null;
  readonly teamSizeMin: number;
  readonly teamSizeMax: number;
  readonly participantCountMin: number;
  readonly participantCountMax: number;
  readonly sortOrder?: number;
}
export interface CreateRulesetInput {
  readonly gameId: string;
  readonly gameModeId: string;
  readonly key: string;
  readonly version: number;
  readonly name: string;
  readonly description?: string | null;
  readonly configuration: RulesetConfig;
}

export interface CreateCrossplayGroupInput {
  readonly gameId: string;
  readonly key: string;
  readonly name: string;
  readonly description?: string | null;
  readonly sortOrder?: number;
}

export interface SetCrossplayPlatformsInput {
  readonly gameId: string;
  readonly crossplayGroupId: string;
  readonly gamePlatformIds: readonly string[];
}

export interface CatalogRecord {
  readonly id: string;
  readonly status: string;
}
export interface RulesetRecord extends CatalogRecord {
  readonly gameId: string;
  readonly gameModeId: string;
  readonly key: string;
  readonly version: number;
  readonly name: string;
  readonly configuration: RulesetConfig;
  readonly isDefault: boolean;
}
