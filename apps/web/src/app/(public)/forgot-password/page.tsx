import { AuthForm } from '@/features/auth/auth-form';
export default function ForgotPage() {
  return (
    <section className="stack">
      <h1>بازیابی گذرواژه</h1>
      <p className="muted">برای حفظ حریم خصوصی، پاسخ وجود یا نبود حساب را مشخص نمی‌کند.</p>
      <AuthForm mode="forgot" />
    </section>
  );
}
