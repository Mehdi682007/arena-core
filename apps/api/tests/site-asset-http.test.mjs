import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createApiApplication } from '../dist/bootstrap.js';

let app;
let baseUrl;
let assetRoot;
const authorization = { hasPermission: vi.fn(async () => true) };
const identity = {
  identity: {},
  sessions: {
    validateSession: vi.fn(async () => ({
      valid: true,
      userId: '00000000-0000-4000-8000-000000000901',
      sessionId: 'site-asset-session',
      mfaVerifiedAt: new Date('2026-08-08T00:00:00Z'),
    })),
  },
  emailVerification: {},
  passwordReset: {},
};

async function upload(auth = true) {
  const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: '#3157d5' } })
    .png()
    .toBuffer();
  const body = new globalThis.FormData();
  body.set('field', 'logoLight');
  body.set('file', new globalThis.Blob([png], { type: 'image/png' }), 'logo.png');
  return globalThis.fetch(`${baseUrl}/admin/settings/site/assets`, {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      ...(auth ? { cookie: 'arena_session=opaque-session-token-value-123456789' } : {}),
    },
    body,
  });
}

beforeAll(async () => {
  assetRoot = await mkdtemp(join(tmpdir(), 'arena-site-assets-http-'));
  const config = createApiConfig(
    {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_ENABLED: 'false',
      AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
      AUTH_REQUIRE_ORIGIN: 'true',
      ARENA_SITE_ASSET_ROOT: assetRoot,
    },
    { packageVersion: '1.0.0', actualNodeVersion: process.versions.node },
  );
  app = await createApiApplication(
    config,
    false,
    { services: identity },
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    { authorization },
  );
  await app.listen(0, '127.0.0.1');
  baseUrl = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
});

afterAll(async () => {
  await app?.close();
  await rm(assetRoot, { recursive: true, force: true });
});

describe('site asset HTTP authorization', () => {
  it('rejects unauthenticated and unauthorized uploads and accepts an authorized admin', async () => {
    expect((await upload(false)).status).toBe(401);
    authorization.hasPermission.mockResolvedValueOnce(false);
    expect((await upload()).status).toBe(403);
    const response = await upload();
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ mime: 'image/png' });
  });
});
