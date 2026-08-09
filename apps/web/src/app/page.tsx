import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { Card } from '@/components/ui';
import { PublicShell } from '@/components/layout/shells';
import { getRequestLocale } from '@/i18n/server';
import { uiMessagesFor } from '@/i18n/ui-messages';
import { serverApi } from '@/lib/api/server-api-client';

type Localized = Readonly<{ fa: string; en: string }>;
type PublicSettings = Readonly<{
  brand: Readonly<{
    siteName: Localized;
    logoLight: { url: string; alt: Localized };
    logoDark: { url: string; alt: Localized };
    footer: Localized;
    termsUrl: string;
    privacyUrl: string;
    primaryColor?: string;
    accentColor?: string;
  }>;
  landing: Readonly<{
    heroTitle: Localized;
    heroSubtitle: Localized;
    primaryAction: Readonly<{ label: Localized; url: string }>;
    secondaryAction: Readonly<{ label: Localized; url: string }>;
    heroImageUrl?: string;
    sections?: readonly {
      key: string;
      visible: boolean;
      title: Localized;
      description: Localized;
      order: number;
    }[];
    announcement: Readonly<{
      enabled: boolean;
      message: Localized;
      startsAt: string | null;
      endsAt: string | null;
      url?: string;
      severity?: string;
    }>;
  }>;
}>;

const faUi = uiMessagesFor('fa');

const fallback: PublicSettings = {
  brand: {
    siteName: { fa: faUi.arenaCore, en: 'Arena Core' },
    logoLight: { url: '', alt: { fa: faUi.arenaCore, en: 'Arena Core' } },
    logoDark: { url: '', alt: { fa: faUi.arenaCore, en: 'Arena Core' } },
    footer: { fa: faUi.transparentAndFairCompetition, en: 'Transparent and fair competition' },
    termsUrl: '',
    privacyUrl: '',
  },
  landing: {
    heroTitle: { fa: faUi.experienceCompetitionProfessionally, en: 'Compete with confidence' },
    heroSubtitle: {
      fa: faUi.registerYourGamingIdentityAndEnterThe,
      en: 'Register your game identity and join the competition.',
    },
    primaryAction: { label: { fa: faUi.getStarted, en: 'Get started' }, url: '/register' },
    secondaryAction: { label: { fa: faUi.leaderboard, en: 'Leaderboards' }, url: '/leaderboards' },
    announcement: { enabled: false, message: { fa: '', en: '' }, startsAt: null, endsAt: null },
  },
};

function announcementActive(announcement: PublicSettings['landing']['announcement']): boolean {
  if (!announcement.enabled) return false;
  const now = Date.now();
  return (
    (!announcement.startsAt || Date.parse(announcement.startsAt) <= now) &&
    (!announcement.endsAt || Date.parse(announcement.endsAt) > now)
  );
}

export default async function HomePage() {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  const settings = await serverApi<PublicSettings>('/site-settings').catch(() => fallback);
  const copy = {
    badge: ui.fairCompetitionTransparentData,
    features: ui.features,
    identity: ui.secureIdentity,
    identityBody: ui.signInSecurelyAndManageYourGaming,
    ranking: ui.authenticRankings,
    rankingBody: ui.viewRealCompetitionDataWithoutFabricatedStatistics,
    notifications: ui.controllableNotifications,
    notificationsBody: ui.reviewAndManageNotificationsWithClearUnderstandable,
  };
  const configuredSections = (settings.landing.sections ?? [])
    .filter((section) => section.visible)
    .sort((a, b) => a.order - b.order);
  const shellStyle = {
    '--brand-primary': settings.brand.primaryColor ?? '#3157d5',
    '--brand-accent': settings.brand.accentColor ?? '#7c3aed',
  } as CSSProperties;

  return (
    <PublicShell
      locale={locale}
      branding={{
        name: settings.brand.siteName[locale],
        logoLight: { url: settings.brand.logoLight.url, alt: settings.brand.logoLight.alt[locale] },
        logoDark: { url: settings.brand.logoDark.url, alt: settings.brand.logoDark.alt[locale] },
        footer: settings.brand.footer[locale],
        legal: [
          { label: ui.conditions, url: settings.brand.termsUrl },
          { label: ui.privacy, url: settings.brand.privacyUrl },
        ].filter((item) => item.url),
      }}
    >
      <main id="main-content" className="container" style={shellStyle}>
        {announcementActive(settings.landing.announcement) ? (
          <div
            className={`alert announcement-${(settings.landing.announcement.severity ?? 'INFO').toLowerCase()}`}
            role="status"
          >
            {settings.landing.announcement.url ? (
              <Link href={settings.landing.announcement.url}>
                {settings.landing.announcement.message[locale]}
              </Link>
            ) : (
              settings.landing.announcement.message[locale]
            )}
          </div>
        ) : null}
        <section className="hero">
          <p className="badge">{copy.badge}</p>
          <h1>{settings.landing.heroTitle[locale]}</h1>
          <p className="muted">{settings.landing.heroSubtitle[locale]}</p>
          {settings.landing.heroImageUrl ? (
            <Image
              className="hero-image"
              src={settings.landing.heroImageUrl}
              alt=""
              width={1200}
              height={600}
              unoptimized
            />
          ) : null}
          <div className="cluster">
            <Link className="button" href={settings.landing.primaryAction.url}>
              {settings.landing.primaryAction.label[locale]}
            </Link>
            <Link className="button secondary" href={settings.landing.secondaryAction.url}>
              {settings.landing.secondaryAction.label[locale]}
            </Link>
          </div>
        </section>
        <section className="grid" aria-label={copy.features}>
          {configuredSections.map((section) => (
            <Card key={section.key}>
              <h2>{section.title[locale]}</h2>
              <p>{section.description[locale]}</p>
            </Card>
          ))}
          {configuredSections.length === 0 ? (
            <>
              <Card>
                <h2>{copy.identity}</h2>
                <p>{copy.identityBody}</p>
              </Card>
            </>
          ) : null}
          <Card>
            <h2>{copy.ranking}</h2>
            <p>{copy.rankingBody}</p>
          </Card>
          <Card>
            <h2>{copy.notifications}</h2>
            <p>{copy.notificationsBody}</p>
          </Card>
        </section>
      </main>
    </PublicShell>
  );
}
