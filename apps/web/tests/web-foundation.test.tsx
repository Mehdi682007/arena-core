import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Alert, Button, Card, EmptyState, Field, Input } from '../src/components/ui';
import { apiRequest } from '../src/lib/api/api-client';
import { ApiError } from '../src/lib/api/api-error';
import { safeReturnPath } from '../src/lib/auth/redirect';
import { messageForCode } from '../src/lib/errors/messages';

afterEach(() => vi.unstubAllGlobals());

describe('design system foundation', () => {
  it('renders semantic accessible primitives', () => {
    const markup = renderToStaticMarkup(
      createElement(
        Card,
        null,
        createElement(Field, {
          label: 'ایمیل',
          name: 'email',
          error: 'نامعتبر',
          children: createElement(Input, { id: 'email', 'aria-invalid': true }),
        }),
        createElement(Button, { disabled: true }, 'ارسال'),
        createElement(Alert, { error: true, children: 'خطا' }),
        createElement(EmptyState, { title: 'خالی' }),
      ),
    );
    expect(markup).toContain('<label for="email">');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('disabled');
  });
  it('defines required visual and focus tokens without dark-mode ambiguity', () => {
    const css = readFileSync(path.resolve(import.meta.dirname, '../src/styles/tokens.css'), 'utf8');
    for (const token of [
      '--color-background',
      '--color-surface',
      '--color-text',
      '--color-primary',
      '--color-danger',
      '--radius-md',
      '--space-4',
      '--focus-ring',
    ])
      expect(css).toContain(token);
    expect(css).toContain('color-scheme: light');
  });
});

describe('navigation and API security', () => {
  it('rejects external and scheme-relative return targets', () => {
    expect(safeReturnPath('/profile?tab=account')).toBe('/profile?tab=account');
    expect(safeReturnPath('//evil.example')).toBe('/dashboard');
    expect(safeReturnPath('https://evil.example')).toBe('/dashboard');
    expect(safeReturnPath('/ok\\evil')).toBe('/dashboard');
  });
  it('includes credentials, JSON and bounded timeout without token storage', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    await apiRequest('https://api.example', '/profile', {
      method: 'PATCH',
      body: { locale: 'fa' },
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example/profile',
      expect.objectContaining({ credentials: 'include', method: 'PATCH', cache: 'no-store' }),
    );
    expect((fetcher.mock.calls[0]?.[1]?.headers as Headers).get('Content-Type')).toBe(
      'application/json',
    );
    expect(JSON.stringify(fetcher.mock.calls[0])).not.toMatch(/authorization|bearer|localStorage/i);
  });
  it('normalizes backend validation and request ID safely', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'VALIDATION_FAILED',
              message: 'internal detail',
              requestId: 'request-123',
              details: { email: ['Invalid value.'] },
            },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    await expect(apiRequest('https://api.example', '/auth/login')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      requestId: 'request-123',
      fieldErrors: { email: 'Invalid value.' },
    } satisfies Partial<ApiError>);
    expect(messageForCode('VALIDATION_FAILED')).not.toContain('internal detail');
  });
});

describe('mock isolation and route foundation', () => {
  it('contains no production mock adapter or secret client variable', () => {
    const root = path.resolve(import.meta.dirname, '..');
    const productionFiles = [
      'src/lib/api/api-client.ts',
      'src/lib/api/browser-api-client.ts',
      'src/app/api/backend/[...path]/route.ts',
    ]
      .map((file) => readFileSync(path.join(root, file), 'utf8'))
      .join('\n');
    expect(productionFiles).not.toMatch(
      /mock service|localStorage|NEXT_PUBLIC_.*SECRET|DATABASE_URL/i,
    );
    expect(productionFiles).toContain("request.headers.get('origin')");
    expect(productionFiles).toContain("'CSRF_ORIGIN_REJECTED'");
  });
});
