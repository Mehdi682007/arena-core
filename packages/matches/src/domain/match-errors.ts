export type MatchErrorCode =
  | 'MATCH_NOT_FOUND'
  | 'MATCH_CREATION_CONFLICT'
  | 'MATCH_PROPOSAL_INVALID'
  | 'MATCH_SNAPSHOT_INVALID'
  | 'MATCH_PARTICIPANT_NOT_FOUND'
  | 'MATCH_READY_DEADLINE_EXPIRED'
  | 'MATCH_STATE_TRANSITION_INVALID'
  | 'MATCH_PERMISSION_DENIED'
  | 'MATCH_SERVICE_UNAVAILABLE'
  | 'MATCH_PERSISTENCE_FAILURE';

export class MatchError extends Error {
  public constructor(public readonly code: MatchErrorCode) {
    super(code.toLowerCase().replaceAll('_', ' '));
    this.name = 'MatchError';
  }
}
