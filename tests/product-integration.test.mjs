import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const includesAll = (text, values) => values.every((value) => text.includes(value));

test('registration and password recovery contracts remain wired end to end', () => {
  const controller = read('apps/api/src/identity/http/identity.controller.ts');
  const web = read('apps/web/src/features/auth/auth-form.tsx');
  assert.ok(
    includesAll(controller, [
      "@Post('register')",
      "@Post('login')",
      "@Post('email-verification/confirm')",
      "@Post('password-reset/request')",
      "@Post('password-reset/confirm')",
    ]),
  );
  assert.ok(includesAll(web, ['/auth/register', '/auth/login']));
});

test('profile, catalog and player identity contracts reach the matchmaking UI', () => {
  const requestPage = read('apps/web/src/app/(app)/matchmaking/request/page.tsx');
  assert.ok(includesAll(requestPage, ['/catalog/games', '/game-accounts']));
  assert.match(read('apps/api/src/player-identity/player-game-account.controller.ts'), /@Get\(\)/);
  assert.match(read('apps/api/src/profile/profile.controller.ts'), /@Patch\('profile'\)/);
});

test('matchmaking proposal acceptance is idempotency-covered before match creation', () => {
  const tests = read('packages/matchmaking/tests/matchmaking-application.test.ts');
  const controller = read('apps/api/src/matchmaking/matchmaking-proposal.controller.ts');
  assert.match(tests, /accepts own side idempotently/);
  assert.ok(
    includesAll(controller, ["@Post(':proposalId/accept')", "@Post(':proposalId/reject')"]),
  );
});

test('ready and start journey retains deadline and duplicate protections', () => {
  const matchTests = read('packages/matches/tests/matches-application.test.ts');
  const resultTests = read('packages/matches/tests/match-result-application.test.ts');
  assert.match(matchTests, /handles repeat idempotently and rejects deadline/);
  assert.match(resultTests, /idempotent after start/);
});

test('agreed, conflicting, draw and void result paths remain connected', () => {
  const result = read('packages/matches/tests/match-result-application.test.ts');
  const domain = read('packages/matches/tests/match-result-domain.test.ts');
  const matches = read('packages/matches/tests/matches-application.test.ts');
  const settlement = read('packages/match-finance/tests/settlement.test.ts');
  const rating = read('packages/rating/tests/rating-calculator.test.ts');
  assert.ok(includesAll(result + domain, ['CONFIRMED', 'CONFLICT']));
  assert.match(domain, /rejects draw from ruleset snapshot/);
  assert.match(settlement, /DRAW_REFUND/);
  assert.match(rating, /outcome: 'DRAW'/);
  assert.match(matches, /voids with audit metadata and is idempotent/);
});

test('settlement and rating application retain exactly-once idempotency gates', () => {
  const settlement = read('packages/match-finance/tests/settlement.test.ts');
  const rating = read('packages/rating/tests/rating-application.test.ts');
  assert.ok(includesAll(settlement, ['idempotencyKey', 'settle-001']));
  assert.ok(includesAll(rating, ['idempotencyKey', 'rating-match-001']));
});

test('all launch notification types are privacy and deduplication covered', () => {
  const coordinator = read('packages/notifications/tests/integration-coordinator.test.ts');
  for (const type of [
    'MATCHMAKING_PROPOSAL_CREATED',
    'MATCH_READY_REQUIRED',
    'MATCH_RESULT_CONFIRMED',
    'MATCH_RESULT_CONFLICT',
    'MATCH_DISPUTE_OPENED',
    'MATCH_DISPUTE_RESOLVED',
    'MATCH_SETTLEMENT_COMPLETED',
    'RATING_UPDATED',
  ])
    assert.ok(coordinator.includes(type), `${type} integration coverage is missing`);
  assert.match(coordinator, /normalizedHandle|walletId|reviewerUserId|providerError/);
});

test('admin capabilities, timelines, diagnostics and notification operations stay registered', () => {
  const admin = read('apps/api/src/admin-operations/admin-operations.controller.ts');
  const notifications = read('apps/api/src/notifications/admin/admin-notifications.controller.ts');
  assert.ok(
    includesAll(admin, [
      "@Get('capabilities')",
      "@Get('audit')",
      "@Get('users/:id/timeline')",
      "@Get('matches/:id/timeline')",
      "@Get('diagnostics')",
    ]),
  );
  assert.ok(
    includesAll(notifications, ["@Get('outbox')", "@Post('outbox/:outboxMessageId/retry')"]),
  );
});

test('web proxy, redirects and admin production routes remain constrained', () => {
  const proxy = read('apps/web/src/app/api/backend/[...path]/route.ts');
  const adminLayout = read('apps/web/src/app/(admin)/admin/layout.tsx');
  assert.match(proxy, /allowedRoots/);
  assert.match(proxy, /CSRF_ORIGIN_REJECTED/);
  assert.match(adminLayout, /returnTo=%2Fadmin/);
  assert.doesNotMatch(
    proxy + adminLayout,
    /impersonate|loginAs|switchUser|dangerouslySetInnerHTML/,
  );
});

test('release candidate artifacts preserve migration and immutable-image policy', () => {
  const manifest = JSON.parse(read('release/manifest.json'));
  const dockerfile = read('docker/Dockerfile');
  const production = read('infra/compose/compose.production.yml');
  assert.equal(manifest.migrations.length, 13);
  assert.ok(includesAll(dockerfile, ['USER 10001:10001', 'node:24.14.0-bookworm-slim']));
  assert.doesNotMatch(production, /:latest\b|privileged:\s*true/);
});
