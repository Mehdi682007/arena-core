import 'server-only';
import { serverApi } from '@/lib/api/server-api-client';
import type {
  AdminCapabilities,
  AuditEvent,
  Diagnostics,
  OutboxItem,
  Page,
  TimelineItem,
} from './types';

export const adminApi = {
  capabilities: () => serverApi<AdminCapabilities>('/admin/capabilities'),
  audit: (query = '') => serverApi<Page<AuditEvent>>(`/admin/audit${query}`),
  auditDetail: (id: string) => serverApi<AuditEvent>(`/admin/audit/${encodeURIComponent(id)}`),
  search: (scope: string, term: string) =>
    serverApi<Record<string, unknown>[]>(
      `/admin/search?scope=${encodeURIComponent(scope)}&term=${encodeURIComponent(term)}&limit=25`,
    ),
  userTimeline: (id: string) =>
    serverApi<TimelineItem[]>(`/admin/users/${encodeURIComponent(id)}/timeline?limit=50`),
  matchTimeline: (id: string) =>
    serverApi<TimelineItem[]>(`/admin/matches/${encodeURIComponent(id)}/timeline?limit=50`),
  outbox: (query = '') => serverApi<Page<OutboxItem>>(`/admin/notifications/outbox${query}`),
  deadLetter: () => serverApi<Page<OutboxItem>>('/admin/notifications/outbox/dead-letter?limit=50'),
  outboxDetail: (id: string) =>
    serverApi<OutboxItem>(`/admin/notifications/outbox/${encodeURIComponent(id)}`),
  diagnostics: () => serverApi<Diagnostics>('/admin/diagnostics'),
};
