import { Card } from '@/components/ui';
import { adminDictionaries } from '@/i18n/admin-dictionary';
import { getRequestLocale } from '@/i18n/server';
export default async function Page() {
  const dictionary = adminDictionaries[await getRequestLocale()];
  return (
    <div className="stack">
      <h1>{dictionary.items.finance.label}</h1>
      <Card>
        <p>{dictionary.common.financeGuidance}</p>
      </Card>
    </div>
  );
}
