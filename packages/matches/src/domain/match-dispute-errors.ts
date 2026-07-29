export type MatchDisputeErrorCode =
  | 'MATCH_DISPUTE_NOT_FOUND'
  | 'MATCH_DISPUTE_ALREADY_ACTIVE'
  | 'MATCH_DISPUTE_OPEN_NOT_ALLOWED'
  | 'MATCH_DISPUTE_WINDOW_EXPIRED'
  | 'MATCH_DISPUTE_RESPONSE_NOT_ALLOWED'
  | 'MATCH_DISPUTE_CANCEL_NOT_ALLOWED'
  | 'MATCH_DISPUTE_STATE_INVALID'
  | 'MATCH_DISPUTE_ASSIGNMENT_INVALID'
  | 'MATCH_DISPUTE_RESOLUTION_INVALID'
  | 'MATCH_DISPUTE_PERMISSION_DENIED'
  | 'MATCH_DISPUTE_SERVICE_UNAVAILABLE'
  | 'MATCH_DISPUTE_PERSISTENCE_FAILURE';
export class MatchDisputeError extends Error {
  public constructor(public readonly code: MatchDisputeErrorCode) {
    super(code.toLowerCase().replaceAll('_', ' '));
    this.name = 'MatchDisputeError';
  }
}
