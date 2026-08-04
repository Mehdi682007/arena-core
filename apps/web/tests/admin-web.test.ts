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
  it('provides a grouped operations console and a diagnostics-backed dashboard', () => {
    const shell = readFileSync(path.join(root, 'src/features/admin/admin-shell.tsx'), 'utf8');
    const dashboard = readFileSync(path.join(root, 'src/app/(admin)/admin/page.tsx'), 'utf8');
    const layout = readFileSync(path.join(root, 'src/app/(admin)/admin/layout.tsx'), 'utf8');

    expect(shell).toContain("'use client'");
    expect(shell).toContain('const navigation: readonly AdminNavigationGroup[]');
    expect(shell).toContain("href: '/admin/diagnostics'");
    expect(shell).toContain("href: '/admin/disputes'");
    expect(shell).toContain("href: '/admin/wallets'");
    expect(shell).toContain("href: '/admin/notifications'");
    expect(shell).toContain('usePathname');
    expect(shell).toContain("aria-current={active ? 'page' : undefined}");
    expect(shell).toContain('allowed.has(item.permission)');

    expect(dashboard).toContain('adminApi.diagnostics()');
    expect(dashboard).toContain('admin-dashboard-hero');
    expect(dashboard).toContain('admin-metric-grid');
    expect(dashboard).toContain('admin-shortcut-grid');
    expect(dashboard).toContain('diagnostics.uptimeSeconds');

    expect(layout).toContain('AdminOperationsShell');
    expect(layout).not.toContain('<AdminShell');
  });

  it('persists an explicit light or dark admin theme with Persian typography', () => {
    const shell = readFileSync(path.join(root, 'src/features/admin/admin-shell.tsx'), 'utf8');
    const toggle = readFileSync(path.join(root, 'src/features/admin/theme-toggle.tsx'), 'utf8');
    const styles = readFileSync(path.join(root, 'src/styles/globals.css'), 'utf8');
    const rootLayout = readFileSync(path.join(root, 'src/app/layout.tsx'), 'utf8');

    expect(shell).toContain('<ThemeToggle />');
    expect(toggle).toContain('arena-admin-theme');
    expect(toggle).toContain('document.documentElement.dataset.theme');
    expect(toggle).toContain('prefers-color-scheme: dark');
    expect(styles).toContain("html[data-theme='dark']");
    expect(styles).toContain("'Vazirmatn Variable'");
    expect(rootLayout).toContain("import '@fontsource-variable/vazirmatn';");
  });

  it('styles legacy administration surfaces consistently in light and dark modes', () => {
    const styles = readFileSync(path.join(root, 'src/styles/globals.css'), 'utf8');

    expect(styles).toContain('ADMIN_OPERATION_SURFACES_V1');
    expect(styles).toContain('.admin-table');
    expect(styles).toContain('.admin-filter');
    expect(styles).toContain('.admin-details');
    expect(styles).toContain('.admin-json');
    expect(styles).toContain('.admin-console dialog');
    expect(styles).toContain("html[data-theme='dark'] .admin-table tbody tr:hover");
    expect(styles).toContain('@media (max-width: 760px)');
  });

  it('provides user status, session and role management surfaces', () => {
    const listPage = readFileSync(path.join(root, 'src/app/(admin)/admin/users/page.tsx'), 'utf8');

    const detailPage = readFileSync(
      path.join(root, 'src/app/(admin)/admin/users/[userId]/page.tsx'),
      'utf8',
    );

    const actions = readFileSync(
      path.join(root, 'src/features/admin/user-access-actions.tsx'),
      'utf8',
    );

    const shell = readFileSync(path.join(root, 'src/features/admin/admin-shell.tsx'), 'utf8');

    expect(listPage).toContain("requireAdminPermission('users.read')");
    expect(listPage).toContain('/admin/users/');
    expect(detailPage).toContain('<UserAccessActions');
    expect(actions).toContain("method: 'PATCH'");
    expect(actions).toContain("method: 'DELETE'");
    expect(actions).toContain('/sessions/revoke');
    expect(actions).toContain('/roles');
    expect(shell).toContain("href: '/admin/users'");
    expect(shell).toContain("permission: 'users.read'");
  });

  it('uses SVG navigation icons instead of font symbols', () => {
    const shell = readFileSync(path.join(root, 'src/features/admin/admin-shell.tsx'), 'utf8');

    const icons = readFileSync(path.join(root, 'src/features/admin/admin-nav-icon.tsx'), 'utf8');

    expect(shell).toContain('<AdminNavIcon href={item.href} />');

    expect(shell).not.toContain('{item.symbol}');
    expect(shell).not.toMatch(/symbol:\\s*['"]/);

    expect(shell).toContain("href: '/admin/users'");

    expect(shell).toContain("permission: 'users.read'");

    expect(icons).toContain("from 'lucide-react'");

    expect(icons).toContain("'/admin/users': Users");

    expect(icons).toContain("'/admin/search': Search");

    expect(icons).toContain('const Icon = iconByHref[href] ?? ShieldCheck');
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
