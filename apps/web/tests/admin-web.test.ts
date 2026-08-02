import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { redactAdminValue, safeAdminHref } from '../src/features/admin/privacy';
import { canonicalHostname, requestOriginForHost } from '../src/lib/host-policy';

const root = path.resolve(import.meta.dirname, '..');
describe('administrative web safety and routes', () => {
  it('recursively redacts sensitive metadata without mutating the source', () => {
    const source = {
      visible: 'ok',
      token: 'secret',
      nested: { walletId: 'wallet', safe: 2 },
      rows: [{ providerError: 'raw', status: 'FAILED' }],
    };
    const result = redactAdminValue(source);
    expect(result).toEqual({
      visible: 'ok',
      token: '[حذف‌شده]',
      nested: { walletId: '[حذف‌شده]', safe: 2 },
      rows: [{ providerError: '[حذف‌شده]', status: 'FAILED' }],
    });
    expect(source.token).toBe('secret');
  });
  it('builds only allowlisted internal support links', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(safeAdminHref('match', id)).toBe(`/admin/matches/${id}/timeline`);
    expect(safeAdminHref('audit', '../outside')).toBeNull();
  });
  it('has an independent protected route boundary and every required admin route', () => {
    const files = [
      'src/app/(admin)/admin/layout.tsx',
      'src/app/(admin)/admin/audit/page.tsx',
      'src/app/(admin)/admin/audit/[auditId]/page.tsx',
      'src/app/(admin)/admin/search/page.tsx',
      'src/app/(admin)/admin/users/[userId]/timeline/page.tsx',
      'src/app/(admin)/admin/matches/[matchId]/timeline/page.tsx',
      'src/app/(admin)/admin/notifications/page.tsx',
      'src/app/(admin)/admin/notifications/outbox/page.tsx',
      'src/app/(admin)/admin/notifications/outbox/[messageId]/page.tsx',
      'src/app/(admin)/admin/notifications/dead-letter/page.tsx',
      'src/app/(admin)/admin/diagnostics/page.tsx',
      'src/app/(admin)/admin/support/page.tsx',
    ];
    for (const file of files)
      expect(() => readFileSync(path.join(root, file), 'utf8')).not.toThrow();
    const layout = readFileSync(path.join(root, 'src/app/(admin)/admin/layout.tsx'), 'utf8');
    expect(layout).toContain("redirect('/login?returnTo=%2Fadmin')");
    expect(layout).toContain("redirect('/dashboard?admin=forbidden')");
    expect(layout).toContain("dynamic = 'force-dynamic'");
  });
  it('keeps prohibited capabilities and unsafe rendering out of production admin UI', () => {
    const files = [
      'src/features/admin/admin-action.tsx',
      'src/features/admin/search-form.tsx',
      'src/features/admin/support-form.tsx',
      'src/features/admin/components.tsx',
      'src/app/(admin)/admin/support/page.tsx',
    ]
      .map((file) => readFileSync(path.join(root, file), 'utf8'))
      .join('\n');
    expect(files).not.toMatch(
      /dangerouslySetInnerHTML|eval\s*\(|new Function|loginAs|actAs|switchUser|assumeIdentity|type=["']file/i,
    );
    expect(files).not.toMatch(
      /localStorage|sessionStorage|wallet\/credit|wallet\/debit|result\/override/i,
    );
    expect(files).toContain("method: 'POST'");
  });
  it('uses exact host-only admin routing without forwarded-host trust', () => {
    process.env.WEB_BASE_URL = 'https://example.test';
    process.env.ADMIN_ORIGIN = 'https://admin.example.test';
    expect(canonicalHostname('example.test:443')).toBe('example.test');
    expect(requestOriginForHost('admin.example.test')).toBe('https://admin.example.test');
    expect(requestOriginForHost('evil.example.test')).toBeNull();
    const proxy = readFileSync(path.join(root, 'src/proxy.ts'), 'utf8');
    expect(proxy).toContain("request.headers.get('host')");
    expect(proxy).not.toMatch(/x-forwarded-host/i);
    expect(proxy).toContain('status: 404');
    expect(proxy).toContain("new URL('/admin'");
  });
});
