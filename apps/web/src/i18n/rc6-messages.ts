import type { AppLocale } from './config';

const catalog = {
  fa: {
    publicProfile: {
      title: 'پروفایل بازیکن',
      identity: 'هویت عمومی',
      activity: 'فعالیت عمومی',
      noActivity: 'هنوز فعالیت عمومی قابل نمایشی وجود ندارد.',
      unavailable: 'پروفایل در حال حاضر در دسترس نیست.',
    },
  },
  en: {
    publicProfile: {
      title: 'Player profile',
      identity: 'Public identity',
      activity: 'Public activity',
      noActivity: 'There is no public activity to show yet.',
      unavailable: 'The profile is currently unavailable.',
    },
  },
} as const;

export function rc6MessagesFor(locale: AppLocale) {
  return catalog[locale];
}
