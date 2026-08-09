import type { AppLocale } from './config';

type Localized = Readonly<{ fa: string; en: string }>;

const statusCatalog: Readonly<Record<string, Localized>> = {
  ACTIVE: { fa: 'فعال', en: 'Active' },
  AWAITING_READY: { fa: 'در انتظار آمادگی', en: 'Waiting for players' },
  AWAITING_RESULT: { fa: 'در انتظار نتیجه', en: 'Waiting for result' },
  CANCELLED: { fa: 'لغوشده', en: 'Cancelled' },
  CHANGES_REQUESTED: { fa: 'نیازمند تغییر', en: 'Changes requested' },
  COMPLETED: { fa: 'تکمیل‌شده', en: 'Completed' },
  CREATED: { fa: 'ایجادشده', en: 'Created' },
  DELIVERED: { fa: 'تحویل‌شده', en: 'Delivered' },
  DISCONNECTED: { fa: 'قطع‌شده', en: 'Disconnected' },
  DRAFT: { fa: 'پیش‌نویس', en: 'Draft' },
  EXPIRED: { fa: 'منقضی‌شده', en: 'Expired' },
  FAILED: { fa: 'ناموفق', en: 'Failed' },
  IN_PROGRESS: { fa: 'در حال اجرا', en: 'In progress' },
  PENDING: { fa: 'در انتظار بررسی', en: 'Pending review' },
  PENDING_VERIFICATION: { fa: 'در انتظار تأیید', en: 'Pending verification' },
  READY: { fa: 'آماده', en: 'Ready' },
  REJECTED: { fa: 'ردشده', en: 'Rejected' },
  RESULT_CONFLICT: { fa: 'تعارض نتیجه', en: 'Result conflict' },
  RUNNING: { fa: 'در حال اجرا', en: 'Running' },
  SENT: { fa: 'ارسال‌شده', en: 'Sent' },
  SUBMITTED: { fa: 'ارسال‌شده', en: 'Submitted' },
  SUSPENDED: { fa: 'معلق', en: 'Suspended' },
  VERIFIED: { fa: 'تأییدشده', en: 'Verified' },
  VOIDED: { fa: 'باطل‌شده', en: 'Voided' },
  LOCKED: { fa: 'قفل‌شده', en: 'Locked' },
  WITHDRAWN: { fa: 'پس‌گرفته‌شده', en: 'Withdrawn' },
  accepted: { fa: 'پذیرفته‌شده', en: 'Accepted' },
  ok: { fa: 'سالم', en: 'Healthy' },
  ready: { fa: 'آماده', en: 'Ready' },
};

const actionCatalog: Readonly<Record<string, Localized>> = {
  APPROVED: { fa: 'تأیید', en: 'Approved' },
  CHANGES_REQUESTED: { fa: 'درخواست تغییر', en: 'Changes requested' },
  DISCONNECTED: { fa: 'قطع اتصال', en: 'Disconnected' },
  REJECTED: { fa: 'رد', en: 'Rejected' },
  RESTORED: { fa: 'بازیابی', en: 'Restored' },
  SUSPENDED: { fa: 'تعلیق', en: 'Suspended' },
  VERIFIED: { fa: 'تأیید', en: 'Verified' },
  verify: { fa: 'تأیید', en: 'Verify' },
  reject: { fa: 'رد', en: 'Reject' },
  'request-changes': { fa: 'درخواست تغییر', en: 'Request changes' },
  suspend: { fa: 'تعلیق', en: 'Suspend' },
  restore: { fa: 'بازیابی', en: 'Restore' },
  disconnect: { fa: 'قطع اتصال', en: 'Disconnect' },
};

const reasonCatalog: Readonly<Record<string, Localized>> = {
  DUPLICATE_ACCOUNT: { fa: 'حساب تکراری', en: 'Duplicate account' },
  INVALID_HANDLE: { fa: 'شناسه نامعتبر', en: 'Invalid handle' },
  OPPONENT_NO_SHOW: { fa: 'عدم حضور حریف', en: 'Opponent did not appear' },
  OTHER: { fa: 'سایر', en: 'Other' },
  RULESET_VIOLATION: { fa: 'نقض قوانین', en: 'Ruleset violation' },
  SCORE_MISMATCH: { fa: 'ناهماهنگی امتیاز', en: 'Score mismatch' },
  WRONG_WINNER: { fa: 'برنده نادرست', en: 'Incorrect winner' },
  HANDLE_NOT_FOUND: { fa: 'شناسه پیدا نشد', en: 'Handle not found' },
  OWNERSHIP_NOT_PROVEN: { fa: 'مالکیت اثبات نشده', en: 'Ownership not proven' },
  INVALID_PLATFORM: { fa: 'پلتفرم نامعتبر', en: 'Invalid platform' },
  INSUFFICIENT_INFORMATION: { fa: 'اطلاعات ناکافی', en: 'Insufficient information' },
  OWNERSHIP_DISPUTE: { fa: 'اختلاف مالکیت', en: 'Ownership dispute' },
  ACCOUNT_TRANSFERRED: { fa: 'حساب منتقل شده', en: 'Account transferred' },
  POLICY_VIOLATION: { fa: 'نقض سیاست', en: 'Policy violation' },
  SECURITY_REVIEW: { fa: 'بررسی امنیتی', en: 'Security review' },
};

const categoryCatalog: Readonly<Record<string, Localized>> = {
  identity: { fa: 'هویت امن', en: 'Secure identity' },
  notifications: { fa: 'اعلان‌ها', en: 'Notifications' },
  rankings: { fa: 'رتبه‌بندی', en: 'Rankings' },
};

const channelCatalog: Readonly<Record<string, Localized>> = {
  EMAIL: { fa: 'ایمیل', en: 'Email' },
  IN_APP: { fa: 'درون‌برنامه‌ای', en: 'In-app' },
};

const evidenceTypeCatalog: Readonly<Record<string, Localized>> = {
  SCREENSHOT_DECLARATION: { fa: 'اظهار اسکرین‌شات', en: 'Screenshot declaration' },
  VIDEO_DECLARATION: { fa: 'اظهار ویدئو', en: 'Video declaration' },
  MATCH_SUMMARY_DECLARATION: { fa: 'اظهار خلاصه مسابقه', en: 'Match summary declaration' },
  TEXT_STATEMENT: { fa: 'بیانیه متنی', en: 'Text statement' },
};

const unknown = (locale: AppLocale, kind: 'status' | 'action' | 'reason' | 'category') => {
  const labels = {
    fa: {
      status: 'وضعیت نامشخص',
      action: 'عملیات نامشخص',
      reason: 'دلیل نامشخص',
      category: 'بخش نامشخص',
    },
    en: {
      status: 'Unknown status',
      action: 'Unknown action',
      reason: 'Unknown reason',
      category: 'Unknown section',
    },
  } as const;
  return labels[locale][kind];
};

export const presentStatus = (value: string, locale: AppLocale) =>
  statusCatalog[value]?.[locale] ?? unknown(locale, 'status');
export const presentAction = (value: string, locale: AppLocale) =>
  actionCatalog[value]?.[locale] ?? unknown(locale, 'action');
export const presentReason = (value: string | null, locale: AppLocale) =>
  value === null ? '—' : (reasonCatalog[value]?.[locale] ?? unknown(locale, 'reason'));
export const presentCategory = (value: string, locale: AppLocale) =>
  categoryCatalog[value]?.[locale] ?? unknown(locale, 'category');
export const presentChannel = (value: string, locale: AppLocale) =>
  channelCatalog[value]?.[locale] ?? (locale === 'fa' ? 'کانال نامشخص' : 'Unknown channel');
export const presentEvidenceType = (value: string, locale: AppLocale) =>
  evidenceTypeCatalog[value]?.[locale] ??
  (locale === 'fa' ? 'نوع مدرک نامشخص' : 'Unknown evidence type');

export const presentationCatalogs = {
  statusCatalog,
  actionCatalog,
  reasonCatalog,
  categoryCatalog,
  channelCatalog,
  evidenceTypeCatalog,
} as const;
