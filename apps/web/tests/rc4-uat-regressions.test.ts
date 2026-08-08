import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const repositoryRoot = path.resolve(root, '../..');

function source(file: string): string {
  return readFileSync(path.join(root, file), 'utf8');
}

describe('RC4 UAT regressions', () => {
  it('sends JSON for bodyless browser writes so logout and session revocation pass the proxy', () => {
    const browserApi = source('src/lib/api/browser-api-client.ts');

    expect(browserApi).toContain("writeMethods.has(method) && options.body === undefined");
    expect(browserApi).toContain('body: {}');
  });

  it('only redirects after logout succeeds and places logout in application navigation', () => {
    const logout = source('src/features/session/logout-button.tsx');
    const shell = source('src/components/layout/shells.tsx');
    const settings = source('src/app/(app)/settings/page.tsx');

    expect(logout).toContain("window.location.replace('/login')");
    expect(logout).not.toContain('finally');
    expect(shell).toContain("from '@/features/session/logout-button'");
    expect(shell.indexOf('<LogoutButton locale={locale} />')).toBeGreaterThan(shell.indexOf('messages.settings'));
    expect(settings).not.toContain('LogoutButton');
  });

  it('localizes API errors for English and Persian', () => {
    const messages = source('src/lib/errors/messages.ts');
    const apiError = source('src/lib/api/api-error.ts');

    expect(messages).toContain("MFA_REQUIRED: 'Enable and verify two-factor authentication");
    expect(messages).toContain("VALIDATION_FAILED: 'Review the information you entered.'");
    expect(apiError).toContain('normalizeLocale(document.documentElement.lang)');
    expect(apiError).toContain('messageForCode(code, currentLocale())');
  });

  it('surfaces profile field validation and constrains country codes', () => {
    const profile = source('src/features/profile/profile-form.tsx');

    expect(profile).toContain('error={error?.fieldErrors?.timezone}');
    expect(profile).toContain('error={error?.fieldErrors?.countryCode}');
    expect(profile).toContain('pattern="[A-Za-z]{2}"');
    expect(profile).toContain(".trim().toUpperCase()");
  });

  it('does not redirect forbidden admin users into a missing dashboard route', () => {
    const layout = source('src/app/(admin)/admin/layout.tsx');
    const access = source('src/features/admin/access.ts');

    expect(layout).not.toContain("redirect('/dashboard?admin=forbidden')");
    expect(layout).toContain("access.status === 'mfa-required'");
    expect(access).toContain("error.code === 'MFA_REQUIRED'");
  });

  it('creates a writable Next.js prerender cache in the web runtime image', () => {
    const dockerfile = readFileSync(path.join(repositoryRoot, 'docker/Dockerfile'), 'utf8');

    expect(dockerfile).toContain('mkdir -p /app/apps/web/.next/cache');
    expect(dockerfile).toContain('chown -R 10001:10001 /app/apps/web/.next');
  });
});
