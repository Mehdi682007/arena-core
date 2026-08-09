const SITE_ASSET_PATH = '/site-assets/';
const PUBLIC_API_PREFIX = '/api/v1';

export function resolveSiteAssetUrl(value: string | null | undefined): string {
  const url = value?.trim() ?? '';
  if (!url) return '';

  if (url === '/site-assets') return `${PUBLIC_API_PREFIX}/site-assets`;
  if (url.startsWith(SITE_ASSET_PATH)) return `${PUBLIC_API_PREFIX}${url}`;

  return url;
}
