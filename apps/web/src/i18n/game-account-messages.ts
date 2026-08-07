import type { AppLocale } from './config';

export interface GameAccountMessages {
  readonly title: string;
  readonly description: string;
  readonly addTitle: string;
  readonly game: string;
  readonly platform: string;
  readonly handle: string;
  readonly handleHint: string;
  readonly create: string;
  readonly creating: string;
  readonly createFailed: string;
  readonly noClaimablePlatforms: string;
  readonly accountsTitle: string;
  readonly noAccounts: string;
  readonly primary: string;
  readonly setPrimary: string;
  readonly disconnect: string;
  readonly resubmit: string;
  readonly actionFailed: string;
  readonly status: Readonly<Record<string, string>>;
}

const fa: GameAccountMessages = {
  title: 'حساب‌های بازی',
  description: 'هویت‌های بازی خود را برای هر بازی و پلتفرم مدیریت کنید.',
  addTitle: 'افزودن هویت بازی',
  game: 'بازی',
  platform: 'پلتفرم',
  handle: 'شناسه بازی',
  handleHint: 'شناسه‌ای را وارد کنید که در همان بازی و پلتفرم استفاده می‌کنید.',
  create: 'ثبت برای بررسی',
  creating: 'در حال ثبت…',
  createFailed: 'ثبت هویت بازی ممکن نشد.',
  noClaimablePlatforms: 'در حال حاضر بازی یا پلتفرم فعالی برای اتصال وجود ندارد.',
  accountsTitle: 'هویت‌های ثبت‌شده',
  noAccounts: 'هنوز هویت بازی ثبت نکرده‌اید.',
  primary: 'اصلی',
  setPrimary: 'انتخاب به‌عنوان اصلی',
  disconnect: 'قطع اتصال',
  resubmit: 'ارسال مجدد برای بررسی',
  actionFailed: 'انجام این عملیات ممکن نشد.',
  status: {
    PENDING: 'در انتظار بررسی',
    VERIFIED: 'تأییدشده',
    REJECTED: 'ردشده',
    SUSPENDED: 'تعلیق‌شده',
    DISCONNECTED: 'قطع‌شده',
  },
};

const en: GameAccountMessages = {
  title: 'Game accounts',
  description: 'Manage your game identities across supported games and platforms.',
  addTitle: 'Add game identity',
  game: 'Game',
  platform: 'Platform',
  handle: 'Game handle',
  handleHint: 'Enter the identity you use for this game on the selected platform.',
  create: 'Submit for review',
  creating: 'Submitting…',
  createFailed: 'Could not submit the game identity.',
  noClaimablePlatforms: 'There are currently no active games or platforms available to connect.',
  accountsTitle: 'Connected identities',
  noAccounts: 'You have not added a game identity yet.',
  primary: 'Primary',
  setPrimary: 'Set as primary',
  disconnect: 'Disconnect',
  resubmit: 'Resubmit for review',
  actionFailed: 'Could not complete this action.',
  status: {
    PENDING: 'Pending review',
    VERIFIED: 'Verified',
    REJECTED: 'Rejected',
    SUSPENDED: 'Suspended',
    DISCONNECTED: 'Disconnected',
  },
};

export function gameAccountMessagesFor(locale: AppLocale): GameAccountMessages {
  return locale === 'fa' ? fa : en;
}
