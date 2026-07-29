export type MatchEvidenceErrorCode =
  | 'MATCH_EVIDENCE_NOT_FOUND'
  | 'MATCH_EVIDENCE_SUBMISSION_NOT_ALLOWED'
  | 'MATCH_EVIDENCE_WITHDRAW_NOT_ALLOWED'
  | 'MATCH_EVIDENCE_OWNERSHIP_INVALID'
  | 'MATCH_EVIDENCE_INVALID';
export class MatchEvidenceError extends Error {
  public constructor(public readonly code: MatchEvidenceErrorCode) {
    super(code.toLowerCase().replaceAll('_', ' '));
    this.name = 'MatchEvidenceError';
  }
}
