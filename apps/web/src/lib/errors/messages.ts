const messages: Readonly<Record<string, string>> = {
  UNAUTHENTICATED: 'برای ادامه وارد حساب خود شوید.',
  INVALID_CREDENTIALS: 'ایمیل یا گذرواژه صحیح نیست.',
  FORBIDDEN: 'اجازه انجام این عملیات را ندارید.',
  VALIDATION_FAILED: 'اطلاعات واردشده را بررسی کنید.',
  RATE_LIMITED: 'درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.',
  CSRF_INVALID: 'اعتبار امنیتی درخواست تأیید نشد.',
  CSRF_ORIGIN_REJECTED: 'مبدأ درخواست تأیید نشد. صفحه را تازه‌سازی کنید.',
  IDENTITY_SERVICE_UNAVAILABLE: 'سرویس حساب کاربری موقتاً در دسترس نیست.',
  NOTIFICATION_SERVICE_UNAVAILABLE: 'سرویس اعلان‌ها موقتاً در دسترس نیست.',
  INTERNAL_SERVER_ERROR: 'خطای غیرمنتظره‌ای رخ داد.',
  INTERNAL_ERROR: 'خطای غیرمنتظره‌ای رخ داد.',
  INVALID_OR_EXPIRED_TOKEN: 'این پیوند نامعتبر یا منقضی شده است.',
};

export function messageForCode(code: string): string {
  return messages[code] ?? 'انجام درخواست ممکن نشد. دوباره تلاش کنید.';
}
