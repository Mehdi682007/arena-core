import type { AppLocale } from './config';

export interface LeaderboardMessages {
  readonly title: (gameName: string) => string;
  readonly game: string;
  readonly mode: string;
  readonly apply: string;
  readonly emptyGames: string;
  readonly emptyModes: string;
  readonly emptyLeaderboard: string;
  readonly caption: string;
  readonly rank: string;
  readonly player: string;
  readonly gameHandle: string;
  readonly rating: string;
  readonly matches: string;
  readonly nextPage: string;
}

const fa: LeaderboardMessages = {
  title: (gameName) => `رتبه‌بندی ${gameName}`,
  game: 'بازی',
  mode: 'حالت بازی',
  apply: 'اعمال',
  emptyGames: 'هنوز بازی فعالی برای رتبه‌بندی عمومی وجود ندارد.',
  emptyModes: 'برای این بازی حالت فعالی برای رتبه‌بندی وجود ندارد.',
  emptyLeaderboard: 'هنوز رتبه‌ای منتشر نشده است',
  caption: 'رتبه‌بندی عمومی بازیکنان',
  rank: 'رتبه',
  player: 'بازیکن',
  gameHandle: 'شناسه بازی',
  rating: 'امتیاز',
  matches: 'بازی',
  nextPage: 'صفحه بعد',
};

const en: LeaderboardMessages = {
  title: (gameName) => `${gameName} leaderboard`,
  game: 'Game',
  mode: 'Game mode',
  apply: 'Apply',
  emptyGames: 'There are no active games available for public leaderboards yet.',
  emptyModes: 'This game has no active leaderboard modes.',
  emptyLeaderboard: 'No rankings have been published yet',
  caption: 'Public player leaderboard',
  rank: 'Rank',
  player: 'Player',
  gameHandle: 'Game identity',
  rating: 'Rating',
  matches: 'Matches',
  nextPage: 'Next page',
};

export function leaderboardMessagesFor(locale: AppLocale): LeaderboardMessages {
  return locale === 'fa' ? fa : en;
}
