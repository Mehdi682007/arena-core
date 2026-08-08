export type GameAccountStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED' | 'DISCONNECTED';
export type GameAccountVerificationMethod = 'UNVERIFIED' | 'MANUAL';
export type GameAccountReviewAction = 'VERIFY' | 'REJECT' | 'SUSPEND' | 'RESTORE' | 'DISCONNECT';

export interface CatalogIdentity {
  readonly id: string;
  readonly key: string;
  readonly slug: string;
  readonly name: string;
}
export interface ClaimableGamePlatform {
  readonly game: CatalogIdentity;
  readonly platform: CatalogIdentity;
  readonly gamePlatformId: string;
  readonly gameActive: boolean;
  readonly gamePlatformActive: boolean;
}

export type ClaimableGamePlatformView = Pick<
  ClaimableGamePlatform,
  'game' | 'platform' | 'gamePlatformId'
>;
export interface UserGameAccountRecord {
  readonly id: string;
  readonly userId: string;
  readonly gameId: string;
  readonly gamePlatformId: string;
  readonly handle: string;
  readonly normalizedHandle: string;
  readonly displayHandle: string;
  readonly status: GameAccountStatus;
  readonly verificationMethod: GameAccountVerificationMethod;
  readonly isPrimary: boolean;
  readonly verifiedAt: Date | null;
  readonly createdAt: Date;
  readonly game: CatalogIdentity;
  readonly platform: CatalogIdentity;
}
export type UserGameAccountView = Omit<
  UserGameAccountRecord,
  'userId' | 'gameId' | 'gamePlatformId' | 'handle' | 'normalizedHandle' | 'verificationMethod'
>;
export interface GameAccountReview {
  readonly id: string;
  readonly gameAccountId: string;
  readonly actorUserId: string | null;
  readonly action: GameAccountReviewAction;
  readonly reasonCode: string | null;
  readonly note: string | null;
  readonly createdAt: Date;
}
export interface AdminReviewInput {
  readonly actorUserId: string;
  readonly accountId: string;
  readonly action: GameAccountReviewAction;
  readonly reasonCode?: string;
  readonly note?: string;
}
