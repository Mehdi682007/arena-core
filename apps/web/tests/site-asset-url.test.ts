import { describe, expect, it } from 'vitest';
import { resolveSiteAssetUrl } from '../src/lib/site-asset-url';

describe('resolveSiteAssetUrl', () => {
  it('prefixes managed site assets with the public API path', () => {
    expect(resolveSiteAssetUrl('/site-assets/logo-light/example.png')).toBe(
      '/api/v1/site-assets/logo-light/example.png',
    );
    expect(resolveSiteAssetUrl('/site-assets')).toBe('/api/v1/site-assets');
  });

  it('keeps external and already resolved URLs unchanged', () => {
    expect(resolveSiteAssetUrl('https://cdn.example.com/logo.png')).toBe(
      'https://cdn.example.com/logo.png',
    );
    expect(resolveSiteAssetUrl('/api/v1/site-assets/logo.png')).toBe(
      '/api/v1/site-assets/logo.png',
    );
  });

  it('returns an empty value for missing assets', () => {
    expect(resolveSiteAssetUrl('')).toBe('');
    expect(resolveSiteAssetUrl(undefined)).toBe('');
    expect(resolveSiteAssetUrl(null)).toBe('');
  });
});
