import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');

describe('responsive administration and locale foundation', () => {
  it('provides locale cookie, direction and shared language control', () => {
    const config = readFileSync(path.join(root, 'src/i18n/config.ts'), 'utf8');

    const rootLayout = readFileSync(path.join(root, 'src/app/layout.tsx'), 'utf8');

    const toggle = readFileSync(path.join(root, 'src/components/language-toggle.tsx'), 'utf8');

    expect(config).toContain("supportedLocales = ['fa', 'en']");
    expect(config).toContain("localeCookieName = 'arena-locale'");
    expect(config).toContain("locale === 'fa' ? 'rtl' : 'ltr'");

    expect(rootLayout).toContain('await getRequestLocale()');
    expect(rootLayout).toContain('<LocaleProvider locale={locale}>');
    expect(rootLayout).toContain('lang={locale}');
    expect(rootLayout).toContain('dir={localeDirection(locale)}');

    expect(toggle).toContain('document.cookie');
    expect(toggle).toContain('window.location.reload()');
  });

  it('provides a mobile drawer without weakening permission filtering', () => {
    const shell = readFileSync(path.join(root, 'src/features/admin/admin-shell.tsx'), 'utf8');

    const styles = readFileSync(path.join(root, 'src/styles/globals.css'), 'utf8');

    expect(shell).toContain('const [menuOpen, setMenuOpen] = useState(false)');

    expect(shell).toContain('allowed.has(item.permission)');
    expect(shell).toContain('admin-console-backdrop');
    expect(shell).toContain('admin-console-menu-toggle');

    expect(shell).toContain('<LanguageToggle compact initialLocale={locale} />');

    expect(styles).toContain('ADMIN_RESPONSIVE_I18N_V1');
    expect(styles).toContain('.admin-console-sidebar.is-open');
    expect(styles).toContain('height: 100dvh');
  });

  it('exposes the language control to public and authenticated users', () => {
    const shells = readFileSync(path.join(root, 'src/components/layout/shells.tsx'), 'utf8');

    expect(shells).toContain("from '@/components/language-toggle'");

    expect(shells.match(/<LanguageToggle\b/g)?.length).toBe(2);

    expect(shells).toContain('initialLocale={locale}');
  });
});
