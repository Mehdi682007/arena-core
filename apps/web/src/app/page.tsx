import Link from 'next/link';
import { Card } from '@/components/ui';
import { PublicShell } from '@/components/layout/shells';
import { getServerLocale } from '@/i18n/server';

export default async function HomePage() {
  const locale = await getServerLocale();
  const copy =
    locale === 'fa'
      ? {
          badge: 'رقابت منصفانه، داده شفاف',
          title: 'مسیر رقابتت را در Arena Core بساز.',
          description:
            'حساب خود را بساز، رتبه‌ات را دنبال کن و اعلان‌های رقابت را در یک فضای فارسی و دسترس‌پذیر ببین.',
          start: 'شروع کنید',
          leaderboard: 'مشاهده رتبه‌بندی',
          features: 'ویژگی‌ها',
          identityTitle: 'هویت امن',
          identityBody: 'ورود مبتنی بر کوکی امن و بدون ذخیره توکن در مرورگر.',
          ratingTitle: 'رتبه‌بندی واقعی',
          ratingBody: 'نمایش داده‌های موجود؛ بدون آمار ساختگی یا وعده مالی.',
          notificationsTitle: 'اعلان‌های قابل‌کنترل',
          notificationsBody: 'مرور و مدیریت اعلان‌ها و ترجیحات کانال‌ها.',
        }
      : {
          badge: 'Fair competition, transparent data',
          title: 'Build your competitive journey with Arena Core.',
          description:
            'Create your account, follow your rating, and manage competition notifications in an accessible experience.',
          start: 'Get started',
          leaderboard: 'View leaderboards',
          features: 'Features',
          identityTitle: 'Secure identity',
          identityBody: 'Secure cookie-based sign-in without storing authentication tokens in browser storage.',
          ratingTitle: 'Real ratings',
          ratingBody: 'See actual platform data without fabricated statistics or financial promises.',
          notificationsTitle: 'Controllable notifications',
          notificationsBody: 'Review notifications and manage delivery preferences.',
        };

  return (
    <PublicShell locale={locale}>
      <main id="main-content" className="container">
        <section className="hero">
          <p className="badge">{copy.badge}</p>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.description}</p>
          <div className="cluster">
            <Link className="button" href="/register">
              {copy.start}
            </Link>
            <Link className="button secondary" href="/leaderboards">
              {copy.leaderboard}
            </Link>
          </div>
        </section>
        <section className="grid" aria-label={copy.features}>
          <Card>
            <h2>{copy.identityTitle}</h2>
            <p>{copy.identityBody}</p>
          </Card>
          <Card>
            <h2>{copy.ratingTitle}</h2>
            <p>{copy.ratingBody}</p>
          </Card>
          <Card>
            <h2>{copy.notificationsTitle}</h2>
            <p>{copy.notificationsBody}</p>
          </Card>
        </section>
      </main>
    </PublicShell>
  );
}
