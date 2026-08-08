import type { AppLocale } from '@/i18n/config';

const fa: Readonly<Record<string, string>> = {
  UNAUTHENTICATED: 'برای ادامه وارد حساب خود شوید.',
  INVALID_CREDENTIALS: 'ایمیل یا گذرواژه صحیح نیست.',
  FORBIDDEN: 'اجازه انجام این عملیات را ندارید.',
  MFA_REQUIRED: 'برای دسترسی به مدیریت، احراز هویت دومرحله‌ای را فعال و تأیید کنید.',
  VALIDATION_FAILED: 'اطلاعات واردشده را بررسی کنید.',
  INVALID_DISPLAY_NAME: 'نام نمایشی معتبر نیست.',
  INVALID_LOCALE: 'زبان انتخاب‌شده معتبر نیست.',
  INVALID_TIMEZONE: 'منطقه زمانی معتبر نیست.',
  INVALID_COUNTRY_CODE: 'کد کشور باید دو حرف انگلیسی مانند IR باشد.',
  PROFILE_UPDATE_CONFLICT: 'پروفایل هم‌زمان تغییر کرده است. صفحه را تازه‌سازی کنید.',
  PROFILE_SERVICE_UNAVAILABLE: 'سرویس پروفایل موقتاً در دسترس نیست.',
  RATE_LIMITED: 'درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.',
  CSRF_INVALID: 'اعتبار امنیتی درخواست تأیید نشد.',
  CSRF_ORIGIN_REJECTED: 'مبدأ درخواست تأیید نشد. صفحه را تازه‌سازی کنید.',
  IDENTITY_SERVICE_UNAVAILABLE: 'سرویس حساب کاربری موقتاً در دسترس نیست.',
  NOTIFICATION_SERVICE_UNAVAILABLE: 'سرویس اعلان‌ها موقتاً در دسترس نیست.',
  INTERNAL_SERVER_ERROR: 'خطای غیرمنتظره‌ای رخ داد.',
  INTERNAL_ERROR: 'خطای غیرمنتظره‌ای رخ داد.',
  INVALID_OR_EXPIRED_TOKEN: 'این پیوند نامعتبر یا منقضی شده است.',
};

const en: Readonly<Record<string, string>> = {
  UNAUTHENTICATED: 'Sign in to continue.',
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  FORBIDDEN: 'You do not have permission to perform this operation.',
  MFA_REQUIRED: 'Enable and verify two-factor authentication to access administration.',
  VALIDATION_FAILED: 'Review the information you entered.',
  INVALID_DISPLAY_NAME: 'The display name is not valid.',
  INVALID_LOCALE: 'The selected language is not valid.',
  INVALID_TIMEZONE: 'The time zone is not valid.',
  INVALID_COUNTRY_CODE: 'The country code must be two English letters, such as IR.',
  PROFILE_UPDATE_CONFLICT: 'The profile changed concurrently. Refresh the page and try again.',
  PROFILE_SERVICE_UNAVAILABLE: 'The profile service is temporarily unavailable.',
  RATE_LIMITED: 'Too many requests. Try again shortly.',
  CSRF_INVALID: 'The security validation for this request failed.',
  CSRF_ORIGIN_REJECTED: 'The request origin could not be verified. Refresh the page.',
  IDENTITY_SERVICE_UNAVAILABLE: 'The account service is temporarily unavailable.',
  NOTIFICATION_SERVICE_UNAVAILABLE: 'The notification service is temporarily unavailable.',
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred.',
  INTERNAL_ERROR: 'An unexpected error occurred.',
  INVALID_OR_EXPIRED_TOKEN: 'This link is invalid or has expired.',
};

const catalogs: Readonly<Record<AppLocale, Readonly<Record<string, string>>>> = Object.freeze({
  fa,
  en,
});

const fallback: Readonly<Record<AppLocale, string>> = Object.freeze({
  fa: 'انجام درخواست ممکن نشد. دوباره تلاش کنید.',
  en: 'The request could not be completed. Try again.',
});

export function messageForCode(code: string, locale: AppLocale = 'fa'): string {
  return catalogs[locale][code] ?? fallback[locale];
}
