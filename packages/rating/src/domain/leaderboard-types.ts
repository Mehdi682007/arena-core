export interface RatingScope {
  readonly gameId: string;
  readonly gameModeId: string;
  readonly crossplayGroupId: string;
  readonly policyKey: 'ELO';
  readonly policyVersion: 1;
}

export interface LeaderboardQuery extends RatingScope {
  readonly cursor?: string;
  readonly limit: number;
  readonly minimumMatchesPlayed: number;
}

export interface LeaderboardEntryView {
  readonly rank: number;
  readonly player: Readonly<{ displayName: string; gameHandle: string }>;
  readonly rating: number;
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
}

export interface LeaderboardPage {
  readonly items: readonly LeaderboardEntryView[];
  readonly nextCursor: string | null;
}
