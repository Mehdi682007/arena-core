'use client';
import { useUiMessages } from '@/i18n/ui-messages-client';
export default function GlobalError() {
  const ui = useUiMessages();
  return (
    <html lang="fa" dir="rtl">
      <body>
        <main>
          <h1>{ui.unexpectedError}</h1>
          <p>{ui.pleaseReloadThePage}</p>
        </main>
      </body>
    </html>
  );
}
