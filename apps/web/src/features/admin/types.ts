export type AdminPermission =
  | 'audit.read'
  | 'support.read'
  | 'support.manage'
  | 'timeline.read'
  | 'diagnostics.read'
  | 'notifications.read'
  | 'notifications.retry'
  | 'notifications.manage';

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
