import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { WalletError } from '@arena-core/wallet';
import { createApiApplication } from '../dist/bootstrap.js';

const userId = '00000000-0000-4000-8000-000000000101';
const transactionId = '00000000-0000-4000-8000-000000000102';
const config = createApiConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_ENABLED: 'false',
    SMTP_ENABLED: 'false',
    AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
    AUTH_REQUIRE_ORIGIN: 'true',
  },
  { packageVersion: '5.1.0', actualNodeVersion: process.versions.node },
);
const identityServices = {
  identity: {},
  sessions: {
    validateSession: vi.fn(async () => ({
      valid: true,
      userId,
      sessionId: 'session-1',
      mfaVerifiedAt: new Date('2026-08-08T00:00:00Z'),
    })),
  },
  emailVerification: {},
  passwordReset: {},
};
let application;
let baseUrl;
let queryService;
let adminService;
let reconciliationService;
let authorization;

function request(path, options = {}) {
  return globalThis.fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.auth === false
        ? {}
        : { cookie: 'arena_session=opaque-session-token-value-123456789' }),
      ...(options.method && options.method !== 'GET'
        ? { 'content-type': 'application/json', origin: options.origin ?? 'http://localhost:3000' }
        : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}
async function start(walletOverrides) {
  application = await createApiApplication(
    config,
    false,
    { services: identityServices },
    {},
    {},
    {},
    {},
    {},
    walletOverrides,
  );
  await application.listen(0, '127.0.0.1');
  const address = application.getHttpServer().address();
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
}
beforeEach(async () => {
  queryService = {
    getMine: vi.fn(async () => ({
      id: 'wallet-1',
      status: 'ACTIVE',
      asset: { code: 'ARENA_POINT', name: 'Arena Point', monetary: false, withdrawable: false },
      balance: '25',
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    })),
    listMine: vi.fn(async () => [
      {
        id: 'entry-1',
        transactionId,
        type: 'ISSUANCE',
        direction: 'CREDIT',
        amount: '25',
        balanceAfter: '25',
        description: 'Arena Point issuance',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]),
  };
  adminService = {
    get: vi.fn(async () => ({ id: 'wallet-1', userId, status: 'ACTIVE', balance: 25n })),
    issue: vi.fn(async (input) => ({ id: transactionId, amount: input.amount, status: 'POSTED' })),
    adjust: vi.fn(async (input) => ({ id: transactionId, amount: input.amount, status: 'POSTED' })),
    reverse: vi.fn(async () => ({ id: transactionId, status: 'POSTED' })),
  };
  reconciliationService = {
    reconcile: vi.fn(async () => ({
      consistent: true,
      storedBalance: 25n,
      derivedBalance: 25n,
      difference: 0n,
    })),
  };
  authorization = { hasPermission: vi.fn(async () => true) };
  await start({ queryService, adminService, reconciliationService, authorization });
});
afterEach(async () => {
  await application?.close();
  application = undefined;
});

describe('wallet HTTP integration', () => {
  it('requires authentication and sets no-store', async () => {
    const unauthorized = await request('/wallet', { auth: false });
    expect(unauthorized.status).toBe(401);
    const response = await request('/wallet');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({
      asset: { code: 'ARENA_POINT', monetary: false, withdrawable: false },
      balance: '25',
    });
    expect(queryService.getMine).toHaveBeenCalledWith(userId);
  });
  it('lists only current-user entries without system accounts or monetary fields', async () => {
    const response = await request('/wallet/ledger?limit=10&direction=CREDIT');
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toMatch(/SYSTEM_|cash|money|currency/i);
    expect(queryService.listMine).toHaveBeenCalledWith(userId, 10, undefined, undefined, 'CREDIT');
  });
  it('denies admin access without permission', async () => {
    authorization.hasPermission.mockResolvedValue(false);
    expect((await request(`/admin/wallets/${userId}`)).status).toBe(403);
  });
  it('supports permission-protected read, issuance, adjustments, reversal, and reconciliation', async () => {
    expect((await request(`/admin/wallets/${userId}`)).status).toBe(200);
    const common = {
      amount: '5',
      idempotencyKey: 'wallet:test:0001',
      reasonCode: 'FOUNDATION_TEST',
    };
    expect(
      (await request(`/admin/wallets/${userId}/issue`, { method: 'POST', body: common })).status,
    ).toBe(201);
    expect(
      (
        await request(`/admin/wallets/${userId}/adjust`, {
          method: 'POST',
          body: { ...common, idempotencyKey: 'wallet:test:0002', direction: 'DEBIT' },
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(`/admin/wallets/transactions/${transactionId}/reverse`, {
          method: 'POST',
          body: { idempotencyKey: 'wallet:test:0003', reasonCode: 'FOUNDATION_TEST' },
        })
      ).status,
    ).toBe(201);
    expect(
      (await request(`/admin/wallets/${userId}/reconcile`, { method: 'POST', body: {} })).status,
    ).toBe(201);
    expect(adminService.issue.mock.calls[0][0]).toMatchObject({
      userId,
      actorUserId: userId,
      amount: 5n,
    });
  });
  it('enforces strict integer DTOs and CSRF origin', async () => {
    const invalid = await request(`/admin/wallets/${userId}/issue`, {
      method: 'POST',
      body: {
        amount: '1.5',
        idempotencyKey: 'wallet:test:0004',
        reasonCode: 'FOUNDATION_TEST',
        extra: true,
      },
    });
    expect(invalid.status).toBe(400);
    const csrf = await request(`/admin/wallets/${userId}/issue`, {
      method: 'POST',
      origin: 'https://evil.example',
      body: { amount: '5', idempotencyKey: 'wallet:test:0005', reasonCode: 'FOUNDATION_TEST' },
    });
    expect(csrf.status).toBe(403);
  });
  it('redacts wallet errors', async () => {
    adminService.adjust.mockRejectedValue(new WalletError('WALLET_INSUFFICIENT_BALANCE'));
    const response = await request(`/admin/wallets/${userId}/adjust`, {
      method: 'POST',
      body: {
        amount: '30',
        direction: 'DEBIT',
        idempotencyKey: 'wallet:test:0006',
        reasonCode: 'FOUNDATION_TEST',
      },
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: 'WALLET_INSUFFICIENT_BALANCE',
        message: 'Wallet operation could not be completed.',
      },
    });
  });
  it('fails closed with a redacted 503 when the database is disabled', async () => {
    await application.close();
    application = undefined;
    await start({});
    const response = await request('/wallet');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: 'WALLET_SERVICE_UNAVAILABLE',
        message: 'Wallet operation could not be completed.',
      },
    });
  });
});
