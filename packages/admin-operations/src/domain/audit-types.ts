export const auditActions = [
  'USER_STATUS_CHANGED',
  'ROLE_ASSIGNED',
  'ROLE_REMOVED',
  'GAME_ACCOUNT_VERIFIED',
  'GAME_ACCOUNT_REJECTED',
  'GAME_ACCOUNT_SUSPENDED',
  'MATCH_VOIDED',
  'RESULT_ADMIN_RESOLVED',
  'DISPUTE_RESOLVED',
  'WALLET_RECONCILIATION_STARTED',
  'WALLET_RECONCILIATION_COMPLETED',
  'NOTIFICATION_RETRY_REQUESTED',
  'NOTIFICATION_RECOVERY_STARTED',
  'RATING_RECONCILIATION_STARTED',
] as const;
export type AuditAction = (typeof auditActions)[number];
export type AuditActorType = 'USER' | 'SYSTEM' | 'SUPPORT';
export interface AuditEvent {
  id: string;
  actorUserId: string | null;
  actorType: AuditActorType;
  action: AuditAction;
  targetType: string;
  targetId: string | null;
  source: string;
  createdAt: Date;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
}
export interface AuditQuery {
  actorUserId?: string;
  targetType?: string;
  targetId?: string;
  action?: AuditAction;
  createdFrom?: Date;
  createdTo?: Date;
  cursor?: string;
  limit: number;
}
export interface TimelineItem {
  id: string;
  type: string;
  occurredAt: Date;
  summary: string;
  data: Readonly<Record<string, string | number | boolean | null>>;
}
export type AdminSearchScope =
  'USER' | 'GAME_ACCOUNT' | 'MATCH' | 'NOTIFICATION' | 'WALLET' | 'RATING';
