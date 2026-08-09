import type { AppLocale } from '@/i18n/config';

export type NotificationCategory =
  'matchmaking' | 'matches' | 'competitions' | 'gameAccounts' | 'security' | 'account' | 'system';

export interface NotificationPresentation {
  readonly title: string;
  readonly description: string;
  readonly category: NotificationCategory;
  readonly icon: 'bell' | 'gamepad' | 'shield' | 'trophy';
  readonly configurable: boolean;
}

type LocalizedPresentation = Readonly<Record<AppLocale, NotificationPresentation>>;

const localized = (
  category: NotificationCategory,
  icon: NotificationPresentation['icon'],
  configurable: boolean,
  fa: readonly [string, string],
  en: readonly [string, string],
): LocalizedPresentation => ({
  fa: { title: fa[0], description: fa[1], category, icon, configurable },
  en: { title: en[0], description: en[1], category, icon, configurable },
});

export const notificationPresentationCatalog = {
  MATCHMAKING_PROPOSAL_CREATED: localized(
    'matchmaking',
    'gamepad',
    true,
    ['پیشنهاد مسابقه جدید', 'یک بازیکن برای مسابقه با شما پیشنهاد شده است.'],
    ['New match proposal', 'A player has been proposed for a match with you.'],
  ),
  MATCHMAKING_PROPOSAL_ACCEPTED: localized(
    'matchmaking',
    'gamepad',
    true,
    ['پیشنهاد پذیرفته شد', 'پیشنهاد مسابقه شما پذیرفته شده است.'],
    ['Proposal accepted', 'Your match proposal has been accepted.'],
  ),
  MATCH_READY_REQUIRED: localized(
    'matches',
    'gamepad',
    true,
    ['تأیید آمادگی', 'برای شروع مسابقه آمادگی خود را تأیید کنید.'],
    ['Ready confirmation', 'Confirm that you are ready to start the match.'],
  ),
  MATCH_STARTED: localized(
    'matches',
    'gamepad',
    true,
    ['شروع مسابقه', 'مسابقه آغاز شده است.'],
    ['Match started', 'The match has started.'],
  ),
  MATCH_RESULT_WAITING: localized(
    'matches',
    'gamepad',
    true,
    ['در انتظار نتیجه', 'نتیجه مسابقه هنوز کامل نشده است.'],
    ['Waiting for result', 'The match result is not complete yet.'],
  ),
  MATCH_RESULT_CONFIRMED: localized(
    'matches',
    'trophy',
    true,
    ['نتیجه تأیید شد', 'نتیجه مسابقه تأیید شده است.'],
    ['Result confirmed', 'The match result has been confirmed.'],
  ),
  MATCH_RESULT_CONFLICT: localized(
    'matches',
    'trophy',
    true,
    ['اختلاف در نتیجه', 'نتیجه‌های ثبت‌شده با یکدیگر هم‌خوانی ندارند.'],
    ['Result conflict', 'The submitted match results do not agree.'],
  ),
  MATCH_DISPUTE_OPENED: localized(
    'matches',
    'shield',
    true,
    ['اعتراض ثبت شد', 'برای مسابقه یک اعتراض ثبت شده است.'],
    ['Dispute opened', 'A dispute has been opened for the match.'],
  ),
  MATCH_DISPUTE_RESPONSE_RECEIVED: localized(
    'matches',
    'shield',
    true,
    ['پاسخ اعتراض دریافت شد', 'پاسخ جدیدی برای اعتراض مسابقه رسیده است.'],
    ['Dispute response received', 'A new response was received for the match dispute.'],
  ),
  MATCH_DISPUTE_RESOLVED: localized(
    'matches',
    'shield',
    true,
    ['اعتراض حل شد', 'بررسی اعتراض مسابقه پایان یافته است.'],
    ['Dispute resolved', 'The match dispute review is complete.'],
  ),
  MATCH_SETTLEMENT_COMPLETED: localized(
    'matches',
    'trophy',
    true,
    ['تسویه مسابقه تکمیل شد', 'تسویه غیرمالی مسابقه ثبت شده است.'],
    ['Match settlement completed', 'The non-monetary match settlement was recorded.'],
  ),
  RATING_UPDATED: localized(
    'competitions',
    'trophy',
    true,
    ['رتبه به‌روز شد', 'امتیاز رقابتی شما تغییر کرده است.'],
    ['Rating updated', 'Your competitive rating has changed.'],
  ),
  SECURITY_SIGN_IN: localized(
    'security',
    'shield',
    false,
    ['ورود جدید به حساب', 'یک ورود جدید به حساب شما ثبت شده است.'],
    ['New account sign-in', 'A new sign-in to your account was recorded.'],
  ),
} as const;

export function notificationPresentation(
  type: string,
  locale: AppLocale,
): NotificationPresentation {
  const known = (notificationPresentationCatalog as Partial<Record<string, LocalizedPresentation>>)[
    type
  ];
  if (known) return known[locale];
  return {
    title: locale === 'fa' ? 'اعلان حساب' : 'Account notification',
    description:
      locale === 'fa'
        ? 'یک رویداد جدید برای حساب شما ثبت شده است.'
        : 'A new event was recorded for your account.',
    category: 'account',
    icon: 'bell',
    configurable: true,
  };
}
