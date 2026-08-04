export type AdminPermission =
  | 'users.read'
  | 'users.manage_status'
  | 'users.manage_sessions'
  | 'users.verify_email'
  | 'roles.read'
  | 'roles.assign'
  | 'roles.manage'
  | 'audit.read'
  | 'support.read'
  | 'support.manage'
  | 'timeline.read'
  | 'diagnostics.read'
  | 'notifications.read'
  | 'notifications.retry'
  | 'notifications.manage'
  | 'games.read'
  | 'games.manage'
  | 'platforms.manage'
  | 'rulesets.manage'
  | 'game_accounts.read'
  | 'game_accounts.verify'
  | 'game_accounts.suspend'
  | 'matches.read'
  | 'matches.manage'
  | 'match_results.read'
  | 'match_results.resolve'
  | 'match_disputes.read'
  | 'match_disputes.assign'
  | 'match_disputes.review'
  | 'matchmaking.read'
  | 'wallets.read'
  | 'wallets.issue'
  | 'wallets.adjust'
  | 'wallets.reverse'
  | 'wallets.reconcile'
  | 'match_finance.read'
  | 'match_finance.manage'
  | 'match_finance.reconcile'
  | 'match_settlements.read'
  | 'match_settlements.manage'
  | 'match_settlements.reconcile'
  | 'ratings.read'
  | 'ratings.manage'
  | 'ratings.reconcile';

export interface AdminCapabilities {
  permissions: AdminPermission[];
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
export interface AuditEvent {
  id: string;
  actorUserId: string | null;
  actorType: string;
  action: string;
  targetType: string;
  targetId: string | null;
  source: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}
export interface TimelineItem {
  id: string;
  type: string;
  occurredAt: string;
  summary: string;
  data: Record<string, unknown>;
}
export interface OutboxItem {
  id: string;
  notificationId: string;
  type: string;
  channel: string;
  status: string;
  availableAt: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  deadLetteredAt: string | null;
  lastErrorCode: string | null;
  version: number;
}
export interface Diagnostics {
  service: string;
  version: string;
  environment: string;
  buildSha: string;
  uptimeSeconds: number;
  dependencies: Record<string, string>;
  shuttingDown: boolean;
  migrationMode: string;
  fingerprint: string;
}
