import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import { AdminSearchForm } from '@/features/admin/search-form';
import { requireAdminPermission } from '@/features/admin/access';
export default async function SearchPage() {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  await requireAdminPermission('support.read');
  return (
    <div className="stack">
      <h1>{ui.searchForSupport}</h1>
      <p>{ui.theSearchIsDoneOnlyAfterSubmitting}</p>
      <AdminSearchForm />
    </div>
  );
}
