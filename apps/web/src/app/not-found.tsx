import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import Link from 'next/link';
export default async function NotFound() {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  return (
    <main className="container page">
      <h1>{ui.pageNotFound}</h1>
      <Link href="/">{ui.returnHome}</Link>
    </main>
  );
}
