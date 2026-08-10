'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, Field, Input } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { useUiMessages } from '@/i18n/ui-messages-client';
import { presentCategory } from '@/i18n/presentation';
import { browserApi } from '@/lib/api/browser-api-client';

type Localized = { fa: string; en: string };
type Settings = {
  brand: {
    siteName: Localized;
    shortTitle: Localized;
    description: Localized;
    logoLight: { url: string; alt: Localized };
    logoDark: { url: string; alt: Localized };
    faviconUrl: string;
    openGraphImageUrl: string;
    primaryColor: string;
    accentColor: string;
    supportEmail: string;
    termsUrl: string;
    privacyUrl: string;
    copyright: Localized;
    footer: Localized;
    socialLinks: { label: Localized; url: string }[];
  };
  landing: {
    heroTitle: Localized;
    heroSubtitle: Localized;
    primaryAction: { label: Localized; url: string };
    secondaryAction: { label: Localized; url: string };
    heroImageUrl: string;
    sections: {
      key: 'identity' | 'rankings' | 'notifications';
      visible: boolean;
      title: Localized;
      description: Localized;
      order: number;
    }[];
    announcement: {
      enabled: boolean;
      message: Localized;
      url: string;
      severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
      startsAt: string | null;
      endsAt: string | null;
    };
  };
};
type Document = { settings: Settings; version: number; publishedAt: string | null };
type AssetTarget = 'logoLight' | 'logoDark' | 'faviconUrl' | 'openGraphImageUrl' | 'heroImageUrl';

function AssetUpload({
  target,
  label,
  accept,
  uploading,
  onUpload,
}: {
  target: AssetTarget;
  label: string;
  accept?: string;
  uploading: string | undefined;
  onUpload: (target: AssetTarget, file?: File) => void;
}) {
  const ui = useUiMessages();
  return (
    <Field name={`asset-${target}`} label={label}>
      <Input
        id={`asset-${target}`}
        type="file"
        accept={accept ?? 'image/png,image/jpeg,image/webp'}
        disabled={uploading !== undefined}
        onChange={(event) => onUpload(target, event.target.files?.[0])}
      />
      {uploading === target ? <span role="status">{ui.loading2}</span> : null}
    </Field>
  );
}

function LocalizedInputs({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: Localized;
  onChange: (language: keyof Localized, value: string) => void;
}) {
  return (['fa', 'en'] as const).map((language) => (
    <Field key={language} name={`${name}-${language}`} label={`${label} (${language})`}>
      <Input
        id={`${name}-${language}`}
        value={value[language]}
        maxLength={500}
        onChange={(event) => onChange(language, event.target.value)}
      />
    </Field>
  ));
}

export function SiteSettingsEditor({ locale }: { locale: AppLocale }) {
  const ui = useUiMessages();
  const [document, setDocument] = useState<Document>();
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'error' | 'saved'>('loading');
  const [uploading, setUploading] = useState<string>();

  useEffect(() => {
    void browserApi<Document>('/admin/settings/site')
      .then((value) => {
        setDocument(value);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  if (!document) {
    return (
      <Alert error={state === 'error'}>
        {state === 'error' ? ui.failedToLoadSiteSettings : ui.loading2}
      </Alert>
    );
  }

  const settings = document.settings;
  const version = document.version;
  const update = (mutate: (next: Settings) => void) => {
    const next = structuredClone(settings);
    mutate(next);
    setDocument({ ...document, settings: next });
  };
  const setBrand = (
    key:
      | 'primaryColor'
      | 'accentColor'
      | 'faviconUrl'
      | 'openGraphImageUrl'
      | 'supportEmail'
      | 'termsUrl'
      | 'privacyUrl',
    value: string,
  ) => update((next) => void (next.brand[key] = value));
  const setBrandLocalized = (
    key: 'siteName' | 'shortTitle' | 'description' | 'copyright' | 'footer',
    language: keyof Localized,
    value: string,
  ) =>
    update((next) => {
      next.brand[key][language] = value;
      if (key === 'siteName') {
        next.brand.logoLight.alt[language] = value;
        next.brand.logoDark.alt[language] = value;
      }
    });
  const setLandingLocalized = (
    key: 'heroTitle' | 'heroSubtitle',
    language: keyof Localized,
    value: string,
  ) => update((next) => void (next.landing[key][language] = value));

  async function save(publish: boolean) {
    setState('saving');
    try {
      const saved = await browserApi<Document>('/admin/settings/site', {
        method: 'PUT',
        body: { settings, expectedVersion: version },
      });
      const result = publish
        ? await browserApi<Document>('/admin/settings/site/publish', {
            method: 'POST',
            body: { expectedVersion: saved.version },
          })
        : saved;
      setDocument(result);
      setState('saved');
    } catch {
      setState('error');
    }
  }

  async function uploadAsset(target: AssetTarget, file?: File) {
    if (!file || uploading) return;
    setUploading(target);
    const body = new FormData();
    body.set('file', file);
    body.set('field', target);
    try {
      const asset = await browserApi<{ url: string }>('/admin/settings/site/assets', {
        method: 'POST',
        body,
        timeoutMs: 20_000,
      });
      update((next) => {
        if (target === 'logoLight' || target === 'logoDark') next.brand[target].url = asset.url;
        else if (target === 'heroImageUrl') next.landing.heroImageUrl = asset.url;
        else next.brand[target] = asset.url;
      });
    } catch {
      setState('error');
    } finally {
      setUploading(undefined);
    }
  }

  return (
    <div className="stack">
      {state === 'error' ? <Alert error>{ui.validationOrStorageFailed}</Alert> : null}
      {state === 'saved' ? <Alert>{ui.settingsSaved}</Alert> : null}

      <Card>
        <h2>{ui.brandIdentity}</h2>
        <AssetUpload
          target="logoLight"
          label={ui.brightLogo}
          uploading={uploading}
          onUpload={(target, file) => void uploadAsset(target, file)}
        />
        <AssetUpload
          target="logoDark"
          label={ui.darkLogo}
          uploading={uploading}
          onUpload={(target, file) => void uploadAsset(target, file)}
        />
        <AssetUpload
          target="faviconUrl"
          label="Favicon"
          accept="image/png,image/x-icon"
          uploading={uploading}
          onUpload={(target, file) => void uploadAsset(target, file)}
        />
        <AssetUpload
          target="openGraphImageUrl"
          label="Open Graph image"
          uploading={uploading}
          onUpload={(target, file) => void uploadAsset(target, file)}
        />
        <LocalizedInputs
          name="site-name"
          label={ui.siteName}
          value={settings.brand.siteName}
          onChange={(language, value) => setBrandLocalized('siteName', language, value)}
        />
        <LocalizedInputs
          name="short-title"
          label={ui.shortTitle}
          value={settings.brand.shortTitle}
          onChange={(language, value) => setBrandLocalized('shortTitle', language, value)}
        />
        <LocalizedInputs
          name="description"
          label={ui.description}
          value={settings.brand.description}
          onChange={(language, value) => setBrandLocalized('description', language, value)}
        />
        <Field name="primary-color" label={ui.mainColor}>
          <Input
            id="primary-color"
            type="color"
            value={settings.brand.primaryColor}
            onChange={(event) => setBrand('primaryColor', event.target.value)}
          />
        </Field>
        <Field name="accent-color" label={ui.complementaryColor}>
          <Input
            id="accent-color"
            type="color"
            value={settings.brand.accentColor}
            onChange={(event) => setBrand('accentColor', event.target.value)}
          />
        </Field>
        <Field name="support-email" label={ui.emailSupport}>
          <Input
            id="support-email"
            type="email"
            dir="ltr"
            value={settings.brand.supportEmail}
            onChange={(event) => setBrand('supportEmail', event.target.value)}
          />
        </Field>
        <Field name="terms-url" label={ui.termsOfUseAddress}>
          <Input
            id="terms-url"
            dir="ltr"
            value={settings.brand.termsUrl}
            onChange={(event) => setBrand('termsUrl', event.target.value)}
          />
        </Field>
        <Field name="privacy-url" label={ui.privacyAddress}>
          <Input
            id="privacy-url"
            dir="ltr"
            value={settings.brand.privacyUrl}
            onChange={(event) => setBrand('privacyUrl', event.target.value)}
          />
        </Field>
        <LocalizedInputs
          name="footer"
          label={ui.footnoteText}
          value={settings.brand.footer}
          onChange={(language, value) => setBrandLocalized('footer', language, value)}
        />
        <LocalizedInputs
          name="copyright"
          label={ui.copyright}
          value={settings.brand.copyright}
          onChange={(language, value) => setBrandLocalized('copyright', language, value)}
        />

        <h3>{ui.socialNetworks}</h3>
        {settings.brand.socialLinks.map((link, index) => (
          <Card key={index}>
            <LocalizedInputs
              name={`social-${String(index)}`}
              label="Label"
              value={link.label}
              onChange={(language, value) =>
                update((next) => {
                  const item = next.brand.socialLinks[index];
                  if (item) item.label[language] = value;
                })
              }
            />
            <Field name={`social-url-${String(index)}`} label="URL">
              <Input
                id={`social-url-${String(index)}`}
                dir="ltr"
                value={link.url}
                onChange={(event) =>
                  update((next) => {
                    const item = next.brand.socialLinks[index];
                    if (item) item.url = event.target.value;
                  })
                }
              />
            </Field>
            <Button
              className="danger"
              type="button"
              onClick={() => update((next) => void next.brand.socialLinks.splice(index, 1))}
            >
              {ui.remove}
            </Button>
          </Card>
        ))}
        <Button
          type="button"
          className="secondary"
          disabled={settings.brand.socialLinks.length >= 10}
          onClick={() =>
            update(
              (next) => void next.brand.socialLinks.push({ label: { fa: '', en: '' }, url: '' }),
            )
          }
        >
          {ui.addSocialLink}
        </Button>
      </Card>

      <Card>
        <h2>{ui.firstPage}</h2>
        <AssetUpload
          target="heroImageUrl"
          label={ui.mainImage}
          uploading={uploading}
          onUpload={(target, file) => void uploadAsset(target, file)}
        />
        <LocalizedInputs
          name="hero-title"
          label="Hero title"
          value={settings.landing.heroTitle}
          onChange={(language, value) => setLandingLocalized('heroTitle', language, value)}
        />
        <LocalizedInputs
          name="hero-subtitle"
          label="Hero subtitle"
          value={settings.landing.heroSubtitle}
          onChange={(language, value) => setLandingLocalized('heroSubtitle', language, value)}
        />
        {(['primaryAction', 'secondaryAction'] as const).map((key) => (
          <div key={key} className="stack">
            <LocalizedInputs
              name={`${key}-label`}
              label={key === 'primaryAction' ? 'Primary CTA' : 'Secondary CTA'}
              value={settings.landing[key].label}
              onChange={(language, value) =>
                update((next) => void (next.landing[key].label[language] = value))
              }
            />
            <Field name={`${key}-url`} label="URL">
              <Input
                id={`${key}-url`}
                dir="ltr"
                value={settings.landing[key].url}
                onChange={(event) =>
                  update((next) => void (next.landing[key].url = event.target.value))
                }
              />
            </Field>
          </div>
        ))}
        <label className="cluster">
          <input
            type="checkbox"
            checked={settings.landing.announcement.enabled}
            onChange={(event) =>
              update((next) => void (next.landing.announcement.enabled = event.target.checked))
            }
          />
          {ui.showPublicNotification}
        </label>
        <LocalizedInputs
          name="announcement"
          label={ui.notification}
          value={settings.landing.announcement.message}
          onChange={(language, value) =>
            update((next) => void (next.landing.announcement.message[language] = value))
          }
        />
        <Field name="announcement-url" label={ui.notificationAddress}>
          <Input
            id="announcement-url"
            dir="ltr"
            value={settings.landing.announcement.url}
            onChange={(event) =>
              update((next) => void (next.landing.announcement.url = event.target.value))
            }
          />
        </Field>
        <Field name="announcement-severity" label={ui.importance}>
          <select
            id="announcement-severity"
            value={settings.landing.announcement.severity}
            onChange={(event) =>
              update(
                (next) =>
                  void (next.landing.announcement.severity = event.target
                    .value as Settings['landing']['announcement']['severity']),
              )
            }
          >
            {(['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] as const).map((value) => (
              <option key={value} value={value}>
                {value === 'INFO'
                  ? 'Info'
                  : value === 'SUCCESS'
                    ? 'Success'
                    : value === 'WARNING'
                      ? 'Warning'
                      : 'Critical'}
              </option>
            ))}
          </select>
        </Field>
        {(['startsAt', 'endsAt'] as const).map((key) => (
          <Field
            key={key}
            name={`announcement-${key}`}
            label={key === 'startsAt' ? ui.start : ui.theEnd}
          >
            <Input
              id={`announcement-${key}`}
              type="datetime-local"
              value={settings.landing.announcement[key]?.slice(0, 16) ?? ''}
              onChange={(event) =>
                update(
                  (next) =>
                    void (next.landing.announcement[key] = event.target.value
                      ? new Date(event.target.value).toISOString()
                      : null),
                )
              }
            />
          </Field>
        ))}

        <div className="grid">
          {settings.landing.sections.map((section, index) => (
            <Card key={section.key}>
              <h3>{presentCategory(section.key, locale)}</h3>
              <label className="cluster">
                <input
                  type="checkbox"
                  checked={section.visible}
                  onChange={(event) =>
                    update((next) => {
                      const item = next.landing.sections[index];
                      if (item) item.visible = event.target.checked;
                    })
                  }
                />
                {ui.show}
              </label>
              <LocalizedInputs
                name={`${section.key}-title`}
                label="Title"
                value={section.title}
                onChange={(language, value) =>
                  update((next) => {
                    const item = next.landing.sections[index];
                    if (item) item.title[language] = value;
                  })
                }
              />
              <LocalizedInputs
                name={`${section.key}-description`}
                label={ui.description}
                value={section.description}
                onChange={(language, value) =>
                  update((next) => {
                    const item = next.landing.sections[index];
                    if (item) item.description[language] = value;
                  })
                }
              />
            </Card>
          ))}
        </div>
      </Card>

      <div className="site-settings-preview">
        <Card>
          <h2>{ui.preview}</h2>
          <h3>{settings.landing.heroTitle[locale]}</h3>
          <p>{settings.landing.heroSubtitle[locale]}</p>
        </Card>
      </div>
      <div className="cluster">
        <Button disabled={state === 'saving'} onClick={() => void save(false)}>
          {ui.saveTheDraft}
        </Button>
        <Button
          className="secondary"
          disabled={state === 'saving'}
          onClick={() => {
            if (window.confirm(ui.publishTheseSettings)) void save(true);
          }}
        >
          {ui.release}
        </Button>
      </div>
    </div>
  );
}
