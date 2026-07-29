import type { AdminSearchScope, AuditEvent, AuditQuery, TimelineItem } from '../domain/audit-types';
export interface AppendAuditInput extends Omit<AuditEvent, 'createdAt'> {
  createdAt: Date;
}
export interface AdminOperationRepository {
  append(input: AppendAuditInput): Promise<AuditEvent>;
  findAudit(id: string): Promise<AuditEvent | null>;
  queryAudit(
    query: AuditQuery,
  ): Promise<{ items: readonly AuditEvent[]; nextCursor: string | null }>;
  search(
    scope: AdminSearchScope,
    term: string,
    limit: number,
  ): Promise<readonly Readonly<Record<string, unknown>>[]>;
  userTimeline(userId: string, limit: number): Promise<readonly TimelineItem[]>;
  matchTimeline(matchId: string, limit: number): Promise<readonly TimelineItem[]>;
}
