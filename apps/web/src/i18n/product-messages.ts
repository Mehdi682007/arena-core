import type { AppLocale } from './config';

export interface ProductMessages {
  readonly dashboard: {
    readonly greeting: (name: string) => string;
    readonly verifyEmail: string;
    readonly verifyEmailAction: string;
    readonly completeOnboarding: string;
    readonly ratingTitle: string;
    readonly noRating: string;
    readonly notificationsTitle: string;
    readonly noNotifications: string;
    readonly quickActions: string;
    readonly completeProfile: string;
  };
  readonly matchmaking: {
    readonly title: string;
    readonly proposalTitle: string;
    readonly deadline: string;
    readonly reviewProposal: string;
    readonly noActiveProposal: string;
    readonly yourAcceptance: string;
    readonly opponentAcceptance: string;
    readonly accepted: string;
    readonly waiting: string;
    readonly timeRemaining: string;
    readonly accept: string;
    readonly reject: string;
    readonly searchingTitle: string;
    readonly noFakeQueueEstimate: string;
    readonly cancelSearch: string;
    readonly refresh: string;
    readonly noActiveSearch: string;
    readonly createRequest: string;
    readonly requestTitle: string;
    readonly serverDetermined: string;
    readonly noVerifiedIdentity: string;
    readonly noCompatibleIdentity: string;
    readonly viewProfile: string;
    readonly noGames: string;
    readonly game: string;
    readonly mode: string;
    readonly gameIdentity: string;
    readonly searchScope: string;
    readonly crossplay: string;
    readonly samePlatform: string;
    readonly createFailed: string;
    readonly creating: string;
    readonly startSearch: string;
  };
  readonly matches: {
    readonly title: string;
    readonly empty: string;
    readonly start: string;
    readonly opponent: string;
    readonly unknownOpponent: string;
    readonly room: string;
  };
  readonly profile: {
    readonly title: string;
    readonly onboardingStatus: string;
    readonly onboardingComplete: string;
    readonly onboardingIncomplete: string;
    readonly remainingSteps: string;
    readonly basicInformation: string;
  };
  readonly notifications: {
    readonly title: string;
    readonly empty: string;
    readonly emptyDescription: string;
    readonly updateFailed: string;
    readonly viewMatchFlow: string;
    readonly new: string;
    readonly markUnread: string;
    readonly markRead: string;
    readonly archive: string;
    readonly more: string;
  };
}

const fa: ProductMessages = {
  dashboard: {
    greeting: (name) => `سلام، ${name}`,
    verifyEmail: 'ایمیل شما هنوز تأیید نشده است.',
    verifyEmailAction: 'تأیید ایمیل',
    completeOnboarding: 'پروفایل خود را برای تکمیل شروع کار به‌روز کنید.',
    ratingTitle: 'رتبه شما',
    noRating: 'هنوز رتبه‌ای ثبت نشده است.',
    notificationsTitle: 'اعلان‌های تازه',
    noNotifications: 'اعلان تازه‌ای ندارید.',
    quickActions: 'اقدام‌های سریع',
    completeProfile: 'تکمیل پروفایل',
  },
  matchmaking: {
    title: 'رقابت',
    proposalTitle: 'پیشنهاد مسابقه',
    deadline: 'مهلت',
    reviewProposal: 'بررسی پیشنهاد',
    noActiveProposal: 'پیشنهاد فعالی وجود ندارد',
    yourAcceptance: 'پذیرش شما',
    opponentAcceptance: 'پذیرش طرف مقابل',
    accepted: 'انجام شده',
    waiting: 'منتظر',
    timeRemaining: 'زمان باقی‌مانده',
    accept: 'پذیرش',
    reject: 'رد',
    searchingTitle: 'جستجو در جریان است',
    noFakeQueueEstimate: 'موقعیت صف و زمان تخمینی ساختگی نمایش داده نمی‌شود.',
    cancelSearch: 'لغو جستجو',
    refresh: 'تازه‌سازی دستی',
    noActiveSearch: 'جستجوی فعالی ندارید',
    createRequest: 'ساخت درخواست رقابت',
    requestTitle: 'درخواست رقابت',
    serverDetermined: 'حریف، امتیاز و ورودی توسط سرور تعیین می‌شود.',
    noVerifiedIdentity: 'هویت بازی تأییدشده ندارید',
    noCompatibleIdentity: 'برای این بازی هویت تأییدشده‌ای ندارید.',
    viewProfile: 'مشاهده پروفایل',
    noGames: 'در حال حاضر بازی فعالی برای رقابت وجود ندارد.',
    game: 'بازی',
    mode: 'حالت',
    gameIdentity: 'هویت بازی',
    searchScope: 'محدوده جستجو',
    crossplay: 'کراس‌پلی سازگار',
    samePlatform: 'همان پلتفرم',
    createFailed: 'ایجاد درخواست ممکن نشد. حساب، حالت و قوانین را بررسی کنید.',
    creating: 'در حال ایجاد…',
    startSearch: 'شروع جستجو',
  },
  matches: {
    title: 'مسابقه‌ها',
    empty: 'مسابقه‌ای ندارید',
    start: 'شروع رقابت',
    opponent: 'حریف',
    unknownOpponent: 'نامشخص',
    room: 'اتاق مسابقه',
  },
  profile: {
    title: 'پروفایل',
    onboardingStatus: 'وضعیت شروع کار',
    onboardingComplete: 'تکمیل‌شده',
    onboardingIncomplete: 'نیازمند تکمیل',
    remainingSteps: 'مراحل باقی‌مانده',
    basicInformation: 'اطلاعات پایه',
  },
  notifications: {
    title: 'اعلان‌ها',
    empty: 'اعلانی ندارید',
    emptyDescription: 'اعلان‌های جدید اینجا نمایش داده می‌شوند.',
    updateFailed: 'به‌روزرسانی اعلان ممکن نشد.',
    viewMatchFlow: 'مشاهده جریان مسابقه',
    new: 'جدید',
    markUnread: 'خوانده‌نشده',
    markRead: 'خوانده شد',
    archive: 'بایگانی',
    more: 'نمایش بیشتر',
  },
};

const en: ProductMessages = {
  dashboard: {
    greeting: (name) => `Welcome, ${name}`,
    verifyEmail: 'Your email address is not verified yet.',
    verifyEmailAction: 'Verify email',
    completeOnboarding: 'Complete your profile to finish account setup.',
    ratingTitle: 'Your rating',
    noRating: 'No rating has been recorded yet.',
    notificationsTitle: 'Recent notifications',
    noNotifications: 'You have no new notifications.',
    quickActions: 'Quick actions',
    completeProfile: 'Complete profile',
  },
  matchmaking: {
    title: 'Compete',
    proposalTitle: 'Match proposal',
    deadline: 'Deadline',
    reviewProposal: 'Review proposal',
    noActiveProposal: 'There is no active proposal',
    yourAcceptance: 'Your acceptance',
    opponentAcceptance: "Opponent's acceptance",
    accepted: 'Accepted',
    waiting: 'Waiting',
    timeRemaining: 'Time remaining',
    accept: 'Accept',
    reject: 'Reject',
    searchingTitle: 'Searching for an opponent',
    noFakeQueueEstimate:
      'Arena Core does not display fabricated queue positions or wait estimates.',
    cancelSearch: 'Cancel search',
    refresh: 'Refresh',
    noActiveSearch: 'You have no active search',
    createRequest: 'Create competition request',
    requestTitle: 'Competition request',
    serverDetermined: 'The server determines the opponent, rating rules, and entry requirements.',
    noVerifiedIdentity: 'You do not have a verified game identity',
    noCompatibleIdentity: 'You do not have a verified identity for this game.',
    viewProfile: 'View profile',
    noGames: 'There are currently no active games available for competition.',
    game: 'Game',
    mode: 'Mode',
    gameIdentity: 'Game identity',
    searchScope: 'Search scope',
    crossplay: 'Compatible cross-play',
    samePlatform: 'Same platform',
    createFailed: 'Could not create the request. Check the account, mode, and ruleset.',
    creating: 'Creating…',
    startSearch: 'Start search',
  },
  matches: {
    title: 'Matches',
    empty: 'You have no matches',
    start: 'Start competing',
    opponent: 'Opponent',
    unknownOpponent: 'Unknown',
    room: 'Match room',
  },
  profile: {
    title: 'Profile',
    onboardingStatus: 'Account setup',
    onboardingComplete: 'Complete',
    onboardingIncomplete: 'Needs attention',
    remainingSteps: 'Remaining steps',
    basicInformation: 'Basic information',
  },
  notifications: {
    title: 'Notifications',
    empty: 'No notifications',
    emptyDescription: 'New notifications will appear here.',
    updateFailed: 'Could not update the notification.',
    viewMatchFlow: 'View match flow',
    new: 'New',
    markUnread: 'Mark unread',
    markRead: 'Mark read',
    archive: 'Archive',
    more: 'Load more',
  },
};

const catalog: Readonly<Record<AppLocale, ProductMessages>> = Object.freeze({ fa, en });

export function productMessagesFor(locale: AppLocale): ProductMessages {
  return catalog[locale];
}
