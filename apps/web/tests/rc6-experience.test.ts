import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { notificationPresentation } from '../src/features/notifications/notification-presentation';

const root = path.resolve(import.meta.dirname, '..');
const source = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('RC6 experience contracts', () => {
  it('never presents a raw notification enum, including unknown types', () => {
    expect(notificationPresentation('MATCHMAKING_PROPOSAL_CREATED', 'en').title).toBe(
      'New match proposal',
    );
    expect(notificationPresentation('UNKNOWN_INTERNAL_EVENT', 'en').title).toBe(
      'Account notification',
    );
    expect(notificationPresentation('UNKNOWN_INTERNAL_EVENT', 'fa').title).not.toContain('UNKNOWN');
    expect(notificationPresentation('SECURITY_SIGN_IN', 'en').configurable).toBe(false);
  });

  it('supports light, dark, and live system preference with pre-hydration bootstrap', () => {
    const toggle = source('src/features/admin/theme-toggle.tsx');
    const layout = source('src/app/layout.tsx');
    expect(toggle).toContain("'light' | 'dark' | 'system'");
    expect(toggle).toContain("media.addEventListener('change'");
    expect(layout).toContain('themeBootstrap');
    expect(layout).toContain('suppressHydrationWarning');
  });

  it('provides reduced-motion and no-blur fallbacks through centralized tokens', () => {
    const tokens = source('src/styles/tokens.css');
    const styles = source('src/styles/globals.css');
    expect(tokens).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('@supports (backdrop-filter: blur(1px))');
    expect(styles).toContain('var(--surface-glass');
  });

  it('keeps the landing page bilingual and driven by published settings', () => {
    const home = source('src/app/page.tsx');
    expect(home).toContain("serverApi<PublicSettings>('/site-settings')");
    expect(home).toContain('uiMessagesFor(locale)');
    expect(home).not.toContain("locale === 'fa'");
    expect(home).toContain('settings.landing.heroTitle[locale]');
    expect(home).toContain('settings.brand.logoLight');
    expect(source('src/app/layout.tsx')).toContain('generateMetadata');
    expect(source('src/components/layout/shells.tsx')).toContain('brand-logo-dark');
  });

  it('provides complete user and admin game-account lifecycle routes', () => {
    expect(source('src/features/settings/game-account-detail.tsx')).toContain("method: 'PATCH'");
    expect(source('src/features/settings/game-account-manager.tsx')).toContain(
      '/account/game-accounts/',
    );
    const operations = source('src/features/admin/game-account-operations.tsx');
    for (const action of [
      'verify',
      'reject',
      'request-changes',
      'suspend',
      'restore',
      'disconnect',
    ])
      expect(operations).toContain(action);
    expect(source('src/app/(admin)/admin/game-accounts/[id]/page.tsx')).toContain(
      'GameAccountReviewPanel',
    );
  });

  it('preserves origin checks while proxying bounded multipart asset uploads', () => {
    const proxy = source('src/app/api/backend/[...path]/route.ts');
    expect(proxy).toContain('multipart/form-data; boundary=');
    expect(proxy).toContain("request.headers.get('origin') !== requestOrigin");
    expect(proxy).toContain('await request.arrayBuffer()');
  });

  it('keeps public profile rendering separate from private account settings', () => {
    const publicProfile = source('src/app/(public)/players/[userId]/page.tsx');
    const privateProfile = source('src/app/(app)/profile/page.tsx');
    expect(publicProfile).toContain('type PublicProfile = { userId: string; displayName: string }');
    expect(publicProfile).not.toMatch(/email|session|timezone|countryCode|security/i);
    expect(publicProfile).toContain('noActivity');
    expect(privateProfile).toContain('serverApi<{ items: readonly UserSessionView[] }>');
    expect(privateProfile).toContain('serverApi<readonly GameAccountView[]>');
  });

  it('uses canonical reason-code contracts instead of free-form review input', () => {
    const operations = source('src/features/admin/game-account-operations.tsx');
    expect(operations).toContain('GAME_ACCOUNT_REJECTION_REASON_CODES');
    expect(operations).toContain('GAME_ACCOUNT_SUSPENSION_REASON_CODES');
    expect(operations).toContain('name="reasonCode"');
    expect(operations).not.toContain('name="reasonCode" maxLength');
  });
});
