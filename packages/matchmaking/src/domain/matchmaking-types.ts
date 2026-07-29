export type MatchmakingRequestStatus =
  'PENDING' | 'SEARCHING' | 'PROPOSED' | 'MATCHED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
export type MatchmakingProposalStatus =
  'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export type MatchmakingSearchScope = 'CROSSPLAY_GROUP' | 'SAME_PLATFORM';
export interface MatchmakingCriteria {
  readonly schemaVersion: 1;
  readonly preferences: {
    readonly language?: 'fa' | 'en';
    readonly region?: string;
  };
}
export interface MatchmakingRequest {
  readonly id: string;
  readonly userId: string;
  readonly userGameAccountId: string;
  readonly gameId: string;
  readonly gameModeId: string;
  readonly gameRulesetId: string;
  readonly gamePlatformId: string;
  readonly crossplayGroupId: string;
  readonly status: MatchmakingRequestStatus;
  readonly searchScope: MatchmakingSearchScope;
  readonly criteria: MatchmakingCriteria;
  readonly priority: number;
  readonly accountVerified: boolean;
  readonly catalogValid: boolean;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly version: number;
}
export interface MatchmakingRequestView {
  readonly id: string;
  readonly status: MatchmakingRequestStatus;
  readonly searchScope: MatchmakingSearchScope;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}
export interface MatchmakingProposal {
  readonly id: string;
  readonly status: MatchmakingProposalStatus;
  readonly requestAId: string;
  readonly requestBId: string;
  readonly userAId: string;
  readonly userBId: string;
  readonly gameId: string;
  readonly gameModeId: string;
  readonly gameRulesetId: string;
  readonly crossplayGroupId: string;
  readonly expiresAt: Date;
  readonly acceptedAAt: Date | null;
  readonly acceptedBAt: Date | null;
  readonly version: number;
}
export interface MatchmakingProposalView {
  readonly id: string;
  readonly status: MatchmakingProposalStatus;
  readonly expiresAt: Date;
  readonly gameId: string;
  readonly gameModeId: string;
  readonly gameRulesetId: string;
  readonly crossplayGroupId: string;
  readonly myAcceptance: boolean;
  readonly opponentAcceptance: boolean;
}
export type MatchmakingIncompatibilityReason =
  | 'SAME_USER'
  | 'REQUEST_NOT_SEARCHING'
  | 'REQUEST_EXPIRED'
  | 'GAME_MISMATCH'
  | 'MODE_MISMATCH'
  | 'RULESET_MISMATCH'
  | 'CROSSPLAY_GROUP_MISMATCH'
  | 'PLATFORM_SCOPE_MISMATCH'
  | 'ACCOUNT_NOT_VERIFIED'
  | 'LANGUAGE_MISMATCH'
  | 'REGION_MISMATCH'
  | 'ACTIVE_PROPOSAL_EXISTS';
export interface CompatibilityResult {
  readonly compatible: boolean;
  readonly reasons: readonly MatchmakingIncompatibilityReason[];
  readonly score: number;
}
export interface MatchmakingCreationContext {
  readonly userId: string;
  readonly userGameAccountId: string;
  readonly gameId: string;
  readonly gameModeId: string;
  readonly gameRulesetId: string;
  readonly gamePlatformId: string;
  readonly crossplayGroupId: string;
  readonly accountVerified: boolean;
  readonly catalogValid: boolean;
}
