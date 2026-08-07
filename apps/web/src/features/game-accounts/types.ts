export interface ClaimableGamePlatform {
  readonly game: {
    readonly id: string;
    readonly key: string;
    readonly slug: string;
    readonly name: string;
  };
  readonly platform: {
    readonly id: string;
    readonly key: string;
    readonly slug: string;
    readonly name: string;
  };
  readonly gamePlatformId: string;
  readonly gameActive: boolean;
  readonly gamePlatformActive: boolean;
}

export interface UserGameAccountView {
  readonly id: string;
  readonly displayHandle: string;
  readonly status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED' | 'DISCONNECTED';
  readonly verificationMethod: 'UNVERIFIED' | 'MANUAL';
  readonly isPrimary: boolean;
  readonly verifiedAt: string | null;
  readonly lastVerifiedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly game: {
    readonly id: string;
    readonly key: string;
    readonly slug: string;
    readonly name: string;
  };
  readonly platform: {
    readonly id: string;
    readonly key: string;
    readonly slug: string;
    readonly name: string;
  };
}
