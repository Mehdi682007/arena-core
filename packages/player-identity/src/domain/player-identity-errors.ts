export type PlayerIdentityErrorCode =
  | 'PLAYER_IDENTITY_UNAVAILABLE'
  | 'GAME_ACCOUNT_NOT_FOUND'
  | 'GAME_ACCOUNT_CONFLICT'
  | 'GAME_ACCOUNT_HANDLE_CONFLICT'
  | 'GAME_ACCOUNT_PLATFORM_INVALID'
  | 'GAME_ACCOUNT_STATUS_TRANSITION_INVALID'
  | 'GAME_ACCOUNT_NOT_VERIFIED'
  | 'GAME_ACCOUNT_ALREADY_PRIMARY'
  | 'GAME_ACCOUNT_PERMISSION_DENIED'
  | 'GAME_ACCOUNT_VERIFICATION_INVALID'
  | 'GAME_ACCOUNT_VERSION_CONFLICT'
  | 'GAME_ACCOUNT_PERSISTENCE_FAILURE'
  | 'GAME_ACCOUNT_QUERY_INVALID'
  | 'INVALID_PLATFORM_HANDLE';

const messages: Record<PlayerIdentityErrorCode, string> = {
  PLAYER_IDENTITY_UNAVAILABLE: 'Player identity is temporarily unavailable.',
  GAME_ACCOUNT_NOT_FOUND: 'Game account was not found.',
  GAME_ACCOUNT_CONFLICT: 'A conflicting game account claim exists.',
  GAME_ACCOUNT_HANDLE_CONFLICT: 'This platform identity cannot be claimed.',
  GAME_ACCOUNT_PLATFORM_INVALID: 'Game platform is not available for this claim.',
  GAME_ACCOUNT_STATUS_TRANSITION_INVALID: 'Game account status transition is not allowed.',
  GAME_ACCOUNT_NOT_VERIFIED: 'Only a verified game account can be primary.',
  GAME_ACCOUNT_ALREADY_PRIMARY: 'Game account is already primary.',
  GAME_ACCOUNT_PERMISSION_DENIED: 'Game account action is not permitted.',
  GAME_ACCOUNT_VERIFICATION_INVALID: 'Game account verification action is invalid.',
  GAME_ACCOUNT_VERSION_CONFLICT: 'Game account changed; reload and try again.',
  GAME_ACCOUNT_PERSISTENCE_FAILURE: 'Game account could not be persisted.',
  GAME_ACCOUNT_QUERY_INVALID: 'Game account query is invalid.',
  INVALID_PLATFORM_HANDLE: 'Platform handle is invalid.',
};
export class PlayerIdentityError extends Error {
  public constructor(public readonly code: PlayerIdentityErrorCode) {
    super(messages[code]);
    this.name = 'PlayerIdentityError';
  }
}
