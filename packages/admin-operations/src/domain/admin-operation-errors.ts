export type AdminOperationErrorCode =
  | 'ADMIN_AUDIT_INVALID'
  | 'ADMIN_AUDIT_NOT_FOUND'
  | 'ADMIN_SEARCH_INVALID'
  | 'ADMIN_TARGET_NOT_FOUND'
  | 'ADMIN_OPERATIONS_UNAVAILABLE'
  | 'ADMIN_OPERATIONS_PERSISTENCE_FAILURE';
export class AdminOperationError extends Error {
  public constructor(public readonly code: AdminOperationErrorCode) {
    super(code);
    this.name = 'AdminOperationError';
  }
}
