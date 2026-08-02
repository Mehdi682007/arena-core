import { Card } from '@/components/ui';
export default function Page() {
  return (
    <div className="stack">
      <h1>مالی مسابقه</h1>
      <Card>
        <p>
          برای مشاهده رزرو و reconciliation، شناسه مسابقه را از صفحه مسابقه انتخاب کنید. تمام عملیات
          مالی از domain service و با idempotency انجام می‌شود.
        </p>
      </Card>
    </div>
  );
}
