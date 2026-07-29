import Link from 'next/link';
import { Card } from '@/components/ui';
import { PublicShell } from '@/components/layout/shells';
export default function HomePage() {
  return (
    <PublicShell>
      <main id="main-content" className="container">
        <section className="hero">
          <p className="badge">رقابت منصفانه، داده شفاف</p>
          <h1>مسیر رقابتت را در Arena Core بساز.</h1>
          <p className="muted">
            حساب خود را بساز، رتبه‌ات را دنبال کن و اعلان‌های رقابت را در یک فضای فارسی و دسترس‌پذیر
            ببین.
          </p>
          <div className="cluster">
            <Link className="button" href="/register">
              شروع کنید
            </Link>
            <Link className="button secondary" href="/leaderboards">
              مشاهده رتبه‌بندی
            </Link>
          </div>
        </section>
        <section className="grid" aria-label="ویژگی‌ها">
          <Card>
            <h2>هویت امن</h2>
            <p>ورود مبتنی بر کوکی امن و بدون ذخیره توکن در مرورگر.</p>
          </Card>
          <Card>
            <h2>رتبه‌بندی واقعی</h2>
            <p>نمایش داده‌های موجود؛ بدون آمار ساختگی یا وعده مالی.</p>
          </Card>
          <Card>
            <h2>اعلان‌های قابل‌کنترل</h2>
            <p>مرور و مدیریت اعلان‌ها و ترجیحات کانال‌ها.</p>
          </Card>
        </section>
      </main>
    </PublicShell>
  );
}
