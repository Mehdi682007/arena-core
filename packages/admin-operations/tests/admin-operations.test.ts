import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  AdminOperationError,
  AdminSearchService,
  AdminTimelineService,
  AuditQueryService,
  SupportOperationService,
  validateAuditMetadata,
  type AdminOperationRepository,
  type AppendAuditInput,
  type AuditEvent,
  type AuditQuery,
  type TimelineItem,
} from '../src';

class MemoryRepository implements AdminOperationRepository {
  public events: AuditEvent[] = [];
  public searches: string[] = [];
  public timelines: TimelineItem[] = [];
  public async append(input: AppendAuditInput) {
    this.events.push(input);
    return input;
  }
  public async findAudit(id: string) {
    return this.events.find((event) => event.id === id) ?? null;
  }
  public async queryAudit(query: AuditQuery) {
    const items = this.events
      .filter((event) => !query.actorUserId || event.actorUserId === query.actorUserId)
      .filter((event) => !query.action || event.action === query.action)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
      .slice(0, query.limit);
    return { items, nextCursor: null };
  }
  public async search(scope: Parameters<AdminOperationRepository['search']>[0], term: string) {
    this.searches.push(`${scope}:${term}`);
    return [{ id: 'safe', status: 'ACTIVE' }];
  }
  public async userTimeline() {
    return this.timelines;
  }
  public async matchTimeline() {
    return this.timelines;
  }
}
const event = (id: string, createdAt: Date): AppendAuditInput => ({
  id,
  actorUserId: '10000000-0000-4000-8000-000000000001',
  actorType: 'SUPPORT',
  action: 'NOTIFICATION_RETRY_REQUESTED',
  targetType: 'NOTIFICATION',
  targetId: id,
  source: 'ADMIN_SUPPORT',
  createdAt,
  metadata: { requested: true },
});

describe('audit foundation', () => {
  it('accepts only flat, bounded metadata', () => {
    expect(validateAuditMetadata({ reason: 'manual', count: 1 })).toEqual({
      reason: 'manual',
      count: 1,
    });
    expect(() => validateAuditMetadata([])).toThrow(AdminOperationError);
  });
  it.each(['passwordHash', 'tokenHash', 'sessionId', 'ip', 'credential', 'secret'])(
    'rejects %s metadata',
    (key) => {
      expect(() => validateAuditMetadata({ [key]: 'value' })).toThrow(AdminOperationError);
    },
  );
  it('appends, filters and deterministically orders events', async () => {
    const repository = new MemoryRepository();
    const service = new AuditQueryService(repository);
    await service.append(event('a', new Date('2026-01-01')));
    await service.append(event('b', new Date('2026-01-02')));
    expect(
      (await service.list({ action: 'NOTIFICATION_RETRY_REQUESTED', limit: 1 })).items[0]?.id,
    ).toBe('b');
    expect(await service.detail('a')).toMatchObject({ id: 'a' });
  });
  it('has no update or delete repository seam', () => {
    expect(Object.keys(new MemoryRepository())).not.toContain('delete');
    expect(Object.keys(new MemoryRepository())).not.toContain('update');
  });
});

describe('search, timeline and support', () => {
  it('validates and delegates bounded searches with safe projections', async () => {
    const repository = new MemoryRepository();
    expect(await new AdminSearchService(repository).search('USER', 'test@example.com', 99)).toEqual(
      [{ id: 'safe', status: 'ACTIVE' }],
    );
    expect(repository.searches).toEqual(['USER:test@example.com']);
    expect(() => new AdminSearchService(repository).search('USER', 'x')).toThrow(
      AdminOperationError,
    );
  });
  it('delegates ordered user and match timelines', async () => {
    const repository = new MemoryRepository();
    repository.timelines = [
      { id: '1', type: 'USER_REGISTERED', occurredAt: new Date(), summary: 'safe', data: {} },
    ];
    const service = new AdminTimelineService(repository);
    expect(await service.user('u')).toEqual(repository.timelines);
    expect(await service.match('m')).toEqual(repository.timelines);
  });
  it('delegates retry/recovery and appends audit events without direct domain mutation', async () => {
    const repository = new MemoryRepository();
    const retry = vi.fn(async () => ({ status: 'PENDING' }));
    const recover = vi.fn(async () => true);
    const service = new SupportOperationService(
      { retry, recover },
      new AuditQueryService(repository),
      { generate: () => 'audit-id' },
      { now: () => new Date('2026-01-01') },
    );
    await service.retry('actor', 'notification');
    await service.recover('actor', 'MATCH', 'match');
    expect(retry).toHaveBeenCalledWith('notification');
    expect(recover).toHaveBeenCalledWith('MATCH', 'match');
    expect(repository.events.map((item) => item.action)).toEqual([
      'NOTIFICATION_RETRY_REQUESTED',
      'NOTIFICATION_RECOVERY_STARTED',
    ]);
  });
  it('enforces append-only storage in the migration', () => {
    const sql = readFileSync(
      '../database/prisma/migrations/20260731120000_create_admin_audit_events/migration.sql',
      'utf8',
    );
    expect(sql).toContain('jsonb_typeof("metadata")');
    expect(sql).toContain('admin_audit_events_no_update');
    expect(sql).toContain('admin_audit_events_no_delete');
  });
});
