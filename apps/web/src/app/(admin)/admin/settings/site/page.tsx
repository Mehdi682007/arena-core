import { uiMessagesFor } from '@/i18n/ui-messages';
import { SiteSettingsEditor } from '@/features/admin/site-settings-editor';
import { getRequestLocale } from '@/i18n/server';

export default async function SiteSettingsPage() {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  return (
    <main id="main-content" className="stack">
      <h1>{ui.siteSettings}</h1>
      <SiteSettingsEditor locale={locale} />
    </main>
  );
}
