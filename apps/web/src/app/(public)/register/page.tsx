import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/features/auth/auth-form';
import { getSession } from '@/features/session/session';
export default async function RegisterPage() {
  if ((await getSession()).status === 'authenticated') redirect('/dashboard');
  return (
    <section className="stack">
      <h1>ثبت‌نام</h1>
      <p className="muted">
        گذرواژه باید الزامات واقعی سرویس را رعایت کند؛ اعتبارسنجی نهایی با سرور است.
      </p>
      <AuthForm mode="register" />
      <Link href="/login">حساب دارید؟ وارد شوید.</Link>
    </section>
  );
}
