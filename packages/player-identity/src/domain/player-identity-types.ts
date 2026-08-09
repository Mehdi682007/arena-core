export type GameAccountStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED'
  | 'SUSPENDED'
  | 'DISCONNECTED';
export type GameAccountVerificationMethod = 'UNVERIFIED' | 'MANUAL';
export type GameAccountReviewAction =
  | 'CREATE'
  | 'UPDATE'
  | 'SUBMIT'
  | 'VERIFY'
  | 'REJECT'
  | 'REQUEST_CHANGES'
  | 'SUSPEND'
  | 'RESTORE'
  | 'DISCONNECT'
  | 'DELETE'
  | 'RESTORE_BY_USER'
  | 'PRIMARY_CHANGE';

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
  readonly submittedAt: Date | null;
  readonly reviewedAt: Date | null;
  readonly reviewedByUserId: string | null;
  readonly verifiedAt: Date | null;
  readonly rejectionReasonCode: string | null;
  readonly reviewMessage: string | null;
  readonly suspensionReasonCode: string | null;
  readonly version: number;
  readonly deletedAt: Date | null;
  readonly createdAt: Date;
  readonly game: CatalogIdentity;
  readonly platform: CatalogIdentity;
}
export type UserGameAccountView = Omit<
  UserGameAccountRecord,
  'userId' | 'gameId' | 'handle' | 'normalizedHandle' | 'verificationMethod' | 'reviewedByUserId'
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
  readonly userMessage?: string;
  readonly expectedVersion: number;
}

export interface AdminGameAccountQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: GameAccountStatus;
  readonly gameId?: string;
  readonly platformId?: string;
  readonly reviewerUserId?: string;
  readonly submittedFrom?: Date;
  readonly submittedTo?: Date;
  readonly recentlyChanged?: boolean;
  readonly userSearch?: string;
  readonly externalId?: string;
}

export type AdminGameAccountRecord = UserGameAccountRecord & {
  readonly ownerDisplayName: string | null;
};

export interface AdminGameAccountPage {
  readonly items: readonly AdminGameAccountRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}
