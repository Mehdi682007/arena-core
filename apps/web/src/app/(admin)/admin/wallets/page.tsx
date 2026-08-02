import { Card } from '@/components/ui';
export default function Page() {
  return (
    <div className="stack">
      <h1>کیف پول و دفترکل</h1>
      <Card>
        <p>
          کاربر را از جستجوی پشتیبانی انتخاب کنید. تغییر موجودی مستقیم وجود ندارد؛ صدور، تعدیل،
          reversal و reconciliation فقط با دلیل و کلید idempotency مجاز است.
        </p>
      </Card>
    </div>
  );
}
