export type MatchResultErrorCode =
  | 'MATCH_START_INVALID'
  | 'MATCH_ALREADY_STARTED'
  | 'MATCH_RESULT_NOT_FOUND'
  | 'MATCH_RESULT_SUBMISSION_NOT_ALLOWED'
  | 'MATCH_RESULT_SUBMISSION_DEADLINE_EXPIRED'
  | 'MATCH_RESULT_ALREADY_FINALIZED'
  | 'MATCH_RESULT_INVALID'
  | 'MATCH_RESULT_WITHDRAW_NOT_ALLOWED'
  | 'MATCH_RESULT_CONFLICT_NOT_FOUND'
  | 'MATCH_RESULT_RESOLUTION_INVALID'
  | 'MATCH_RESULT_PERMISSION_DENIED'
  | 'MATCH_RESULT_SERVICE_UNAVAILABLE'
  | 'MATCH_RESULT_PERSISTENCE_FAILURE';

export class MatchResultError extends Error {
  public constructor(public readonly code: MatchResultErrorCode) {
    super(code.toLowerCase().replaceAll('_', ' '));
    this.name = 'MatchResultError';
  }
}
