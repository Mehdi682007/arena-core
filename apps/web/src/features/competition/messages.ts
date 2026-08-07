import type { AppLocale } from '@/i18n/config';

export interface CompetitionMessages {
  readonly room: {
    readonly participants: string;
    readonly you: string;
    readonly ready: string;
    readonly waiting: string;
    readonly rules: string;
    readonly version: string;
    readonly nonMonetaryEntry: string;
    readonly nonWithdrawable: string;
    readonly imReady: string;
    readonly startMatch: string;
    readonly resultAndEvidence: string;
    readonly dispute: string;
    readonly result: string;
    readonly nonMonetarySettlement: string;
    readonly received: string;
    readonly currentRating: string;
    readonly matchRatingChange: string;
  };
  readonly result: {
    readonly title: string;
    readonly status: string;
    readonly yourSubmission: string;
    readonly yourStatements: string;
    readonly ownSide: string;
    readonly sideA: string;
    readonly sideB: string;
    readonly ownScore: string;
    readonly opponentScore: string;
    readonly submitted: string;
    readonly submitFailed: string;
    readonly submitting: string;
    readonly submit: string;
    readonly evidenceTitle: string;
    readonly evidenceNotice: string;
    readonly screenshot: string;
    readonly video: string;
    readonly matchSummary: string;
    readonly textStatement: string;
    readonly evidenceDescription: string;
    readonly evidenceSubmitted: string;
    readonly evidenceFailed: string;
    readonly submitEvidence: string;
  };
  readonly dispute: {
    readonly title: string;
    readonly resolution: string;
    readonly responseDeadline: string;
    readonly submitted: string;
    readonly failed: string;
    readonly scoreMismatch: string;
    readonly wrongWinner: string;
    readonly opponentNoShow: string;
    readonly rulesetViolation: string;
    readonly other: string;
    readonly keepResult: string;
    readonly correctScore: string;
    readonly voidMatch: string;
    readonly statement: string;
    readonly respond: string;
    readonly open: string;
  };
}

const fa: CompetitionMessages = {
  room: {
    participants: 'شرکت‌کنندگان',
    you: 'شما',
    ready: 'آماده',
    waiting: 'منتظر',
    rules: 'قوانین',
    version: 'نسخه',
    nonMonetaryEntry: 'ورودی غیرپولی',
    nonWithdrawable: 'غیرقابل برداشت و بدون ارزش پولی',
    imReady: 'آماده‌ام',
    startMatch: 'شروع مسابقه',
    resultAndEvidence: 'نتیجه و مدارک',
    dispute: 'اعتراض',
    result: 'نتیجه',
    nonMonetarySettlement: 'تسویه غیرپولی',
    received: 'دریافتی شما',
    currentRating: 'رتبه فعلی',
    matchRatingChange: 'تغییر این مسابقه',
  },
  result: {
    title: 'نتیجه مسابقه',
    status: 'وضعیت',
    yourSubmission: 'ارسال شما',
    yourStatements: 'اظهارهای شما',
    ownSide: 'سمت شما',
    sideA: 'سمت A',
    sideB: 'سمت B',
    ownScore: 'امتیاز شما',
    opponentScore: 'امتیاز حریف',
    submitted: 'نتیجه ثبت شد. نتیجه نهایی فقط پس از تأیید سرور نمایش داده می‌شود.',
    submitFailed: 'ثبت نتیجه ممکن نشد.',
    submitting: 'در حال ثبت…',
    submit: 'ثبت نتیجه',
    evidenceTitle: 'اظهار مدرک',
    evidenceNotice: 'آپلود فایل انجام نمی‌شود؛ فقط وجود و توضیح مدرک اعلام می‌شود.',
    screenshot: 'تصویر',
    video: 'ویدئو',
    matchSummary: 'خلاصه مسابقه',
    textStatement: 'اظهار متنی',
    evidenceDescription: 'توضیح مدرک',
    evidenceSubmitted: 'اظهار مدرک ثبت شد.',
    evidenceFailed: 'ثبت اظهار مدرک ممکن نشد.',
    submitEvidence: 'ثبت اظهار',
  },
  dispute: {
    title: 'اعتراض مسابقه',
    resolution: 'نتیجه رسیدگی',
    responseDeadline: 'مهلت پاسخ',
    submitted: 'درخواست ثبت شد.',
    failed: 'ثبت درخواست ممکن نشد.',
    scoreMismatch: 'عدم تطابق امتیاز',
    wrongWinner: 'برنده نادرست',
    opponentNoShow: 'عدم حضور حریف',
    rulesetViolation: 'نقض قوانین',
    other: 'سایر',
    keepResult: 'حفظ نتیجه',
    correctScore: 'اصلاح امتیاز',
    voidMatch: 'باطل‌کردن مسابقه',
    statement: 'شرح اعتراض یا پاسخ',
    respond: 'ارسال پاسخ',
    open: 'بازکردن اعتراض',
  },
};

const en: CompetitionMessages = {
  room: {
    participants: 'Participants',
    you: 'You',
    ready: 'Ready',
    waiting: 'Waiting',
    rules: 'Rules',
    version: 'Version',
    nonMonetaryEntry: 'Non-monetary entry',
    nonWithdrawable: 'Non-withdrawable and has no monetary value',
    imReady: "I'm ready",
    startMatch: 'Start match',
    resultAndEvidence: 'Result & evidence',
    dispute: 'Dispute',
    result: 'Result',
    nonMonetarySettlement: 'Non-monetary settlement',
    received: 'You received',
    currentRating: 'Current rating',
    matchRatingChange: 'Change from this match',
  },
  result: {
    title: 'Match result',
    status: 'Status',
    yourSubmission: 'Your submission',
    yourStatements: 'Your evidence statements',
    ownSide: 'Your side',
    sideA: 'Side A',
    sideB: 'Side B',
    ownScore: 'Your score',
    opponentScore: "Opponent's score",
    submitted: 'Result submitted. The final result appears only after server confirmation.',
    submitFailed: 'Could not submit the result.',
    submitting: 'Submitting…',
    submit: 'Submit result',
    evidenceTitle: 'Evidence statement',
    evidenceNotice: 'No file is uploaded here. You only declare the evidence and describe it.',
    screenshot: 'Screenshot',
    video: 'Video',
    matchSummary: 'Match summary',
    textStatement: 'Text statement',
    evidenceDescription: 'Evidence description',
    evidenceSubmitted: 'Evidence statement submitted.',
    evidenceFailed: 'Could not submit the evidence statement.',
    submitEvidence: 'Submit statement',
  },
  dispute: {
    title: 'Match dispute',
    resolution: 'Resolution',
    responseDeadline: 'Response deadline',
    submitted: 'Request submitted.',
    failed: 'Could not submit the request.',
    scoreMismatch: 'Score mismatch',
    wrongWinner: 'Wrong winner',
    opponentNoShow: 'Opponent no-show',
    rulesetViolation: 'Ruleset violation',
    other: 'Other',
    keepResult: 'Keep current result',
    correctScore: 'Correct score',
    voidMatch: 'Void match',
    statement: 'Dispute or response statement',
    respond: 'Send response',
    open: 'Open dispute',
  },
};

export function competitionMessagesFor(locale: AppLocale): CompetitionMessages {
  return locale === 'fa' ? fa : en;
}
