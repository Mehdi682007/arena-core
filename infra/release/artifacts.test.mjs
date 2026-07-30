import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { images, migrations, root } from '../../scripts/release/release-lib.mjs';

const read = (file) => readFile(path.join(root, file), 'utf8');

async function validateImageManifest(mutator = () => undefined) {
  const manifest = JSON.parse(await read('release/deployment-images.example.json'));
  mutator(manifest);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'arena-image-manifest-'));
  const manifestPath = path.join(directory, 'deployment-images.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
  try {
    return spawnSync(
      process.platform === 'win32' ? 'python' : 'python3',
      ['infra/scripts/validate-image-manifest.py', manifestPath, manifest.releaseId],
      { cwd: root, encoding: 'utf8' },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function validateSeedCompose(mutator = () => undefined, expectedImage) {
  const image =
    expectedImage ?? `ghcr.io/example/arena-seed:${'a'.repeat(40)}@sha256:${'b'.repeat(64)}`;
  const document = {
    services: {
      'arena-seed': {
        image,
        user: '10001:10001',
        read_only: true,
        tmpfs: ['/tmp:rw,noexec,nosuid,size=64m'],
        networks: { app: null, data: null },
        volumes: [],
      },
    },
  };
  mutator(document.services['arena-seed']);
  return spawnSync(
    process.platform === 'win32' ? 'python' : 'python3',
    ['infra/scripts/validate-seed-compose.py', image],
    { cwd: root, encoding: 'utf8', input: JSON.stringify(document) },
  );
}

test('Dockerfile defines pinned multi-stage non-root targets', async () => {
  const value = await read('docker/Dockerfile');
  assert.match(value, /FROM node:24\.14\.0-bookworm-slim AS base/);
  assert.match(value, /pnpm install --frozen-lockfile/);
  for (const target of ['api', 'worker', 'web']) {
    assert.match(value, new RegExp(`FROM runtime AS ${target}`));
  }
  for (const target of ['migrate', 'seed']) {
    assert.match(value, new RegExp(`FROM job-runtime AS ${target}`));
  }
  assert.ok((value.match(/USER 10001:10001/g) ?? []).length >= 1);
  assert.doesNotMatch(value, /\b(latest|start:dev|db push)\b/i);
});

test('image build uses only loopback placeholder database URLs', async () => {
  const dockerfile = await readFile(path.join(root, 'docker/Dockerfile'), 'utf8');
  assert.match(
    dockerfile,
    /ENV DATABASE_DIRECT_URL=postgresql:\/\/build:build@127\.0\.0\.1:5432\/build/,
  );
  assert.doesNotMatch(dockerfile, /ENV DATABASE_DIRECT_URL=\$\{/);
  assert.match(dockerfile, /turbo run build --env-mode=loose/);
});

test('production Compose has hardened services and manual seed', async () => {
  const value = await read('infra/compose/compose.production.yml');
  for (const service of ['arena-api', 'arena-worker', 'arena-web', 'arena-migrate', 'arena-seed']) {
    assert.match(value, new RegExp(`\\n {2}${service}:`));
  }
  assert.match(value, /profiles: \[seed\]/);
  assert.match(value, /read_only: true/);
  assert.match(value, /no-new-privileges:true/);
  assert.match(value, /cap_drop: \[ALL\]/);
  assert.doesNotMatch(value, /\b(privileged|network_mode:\s*host|docker\.sock)\b/);
  assert.doesNotMatch(value, /postgres:[\s\S]*ports:/);
});

test('release manifest locks all migrations and immutable image tags', async () => {
  const manifest = JSON.parse(await read('release/manifest.json'));
  assert.deepEqual(manifest.migrations, await migrations());
  for (const image of images) {
    assert.match(manifest.images[image], /:[^:]+-(?:[0-9a-f]{12}|uncommitted)$/i);
    assert.doesNotMatch(manifest.images[image], /:latest$/);
  }
});

test('prebuilt deployment manifest example contains five digest-pinned images', async () => {
  const manifest = JSON.parse(await read('release/deployment-images.example.json'));
  assert.equal(manifest.schemaVersion, 1);
  assert.match(manifest.sourceCommit, /^[0-9a-f]{40}$/);
  assert.deepEqual(Object.keys(manifest.images).sort(), [
    'api',
    'migrate',
    'seed',
    'web',
    'worker',
  ]);
  for (const image of Object.values(manifest.images)) {
    assert.notEqual(image.tag, 'latest');
    assert.match(image.digest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(image.reference, `${image.name}:${image.tag}@${image.digest}`);
  }
});

test('deployment image validator enforces immutable Seed identity', async () => {
  assert.equal((await validateImageManifest()).status, 0);

  assert.notEqual(
    (
      await validateImageManifest((manifest) => {
        delete manifest.images.seed;
      })
    ).status,
    0,
  );
  assert.notEqual(
    (
      await validateImageManifest((manifest) => {
        manifest.images.seed.digest = `sha256:${'6'.repeat(64)}`;
      })
    ).status,
    0,
  );
  assert.notEqual(
    (
      await validateImageManifest((manifest) => {
        manifest.images.seed.name = 'ghcr.io/example/arena-not-seed';
        manifest.images.seed.reference = `${manifest.images.seed.name}:${manifest.images.seed.tag}@${manifest.images.seed.digest}`;
      })
    ).status,
    0,
  );
  assert.notEqual(
    (
      await validateImageManifest((manifest) => {
        manifest.images.seed.tag = 'latest';
        manifest.images.seed.reference = `${manifest.images.seed.name}:latest@${manifest.images.seed.digest}`;
      })
    ).status,
    0,
  );
});

test('prebuilt workflow builds sequentially, pushes immutable images, and never deploys', async () => {
  const workflow = await read('.github/workflows/prebuilt-images.yml');
  const builder = await read('scripts/release/build-prebuilt-images.sh');
  const migrationValidator = await read('scripts/release/validate-migration-image.sh');
  const seedValidator = await read('scripts/release/validate-seed-image.sh');
  const composeRuntimeValidator = await read('scripts/release/validate-seed-compose-runtime.sh');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /packages: write/);
  assert.match(workflow, /bash scripts\/release\/build-prebuilt-images\.sh/);
  assert.doesNotMatch(workflow, /strategy:\s*\n\s+matrix:|\bssh\b|scp|rsync/);
  assert.match(builder, /for service in migrate api worker web seed; do/);
  assert.match(workflow, /Build and push five targets sequentially/);
  assert.match(builder, /--target "\$service"/);
  assert.match(builder, /arena-\$service/);
  assert.match(builder, /docker build[\s\S]*--target "\$service"/);
  assert.match(builder, /docker push "\$tagged"/);
  assert.match(builder, /buildx imagetools inspect/);
  assert.match(builder, /latest is forbidden/);
  assert.match(builder, /validate-migration-image\.sh "\$tagged"/);
  assert.match(builder, /validate-seed-image\.sh/);
  assert.match(builder, /org\.opencontainers\.image\.revision/);
  assert.match(builder, /org\.opencontainers\.image\.version/);
  assert.match(builder, /source commit label mismatch/);
  assert.match(builder, /release ID label mismatch/);
  assert.match(builder, /xargs -0 -n1 bash -n/);
  assert.match(builder, /shellcheck --severity=warning --exclude=SC1091,SC2034/);
  assert.match(migrationValidator, /docker run --rm --network none/);
  assert.match(migrationValidator, /\/usr\/local\/bin\/pnpm/);
  assert.match(migrationValidator, /readlink -f \/usr\/local\/bin\/pnpm/);
  assert.match(migrationValidator, /pnpm\/package\.json/);
  assert.match(migrationValidator, /pnpm_executable.*corepack/s);
  assert.match(migrationValidator, /expected_pnpm_version=11\.9\.0/);
  assert.match(migrationValidator, /registry\\\.npmjs\\\.org/);
  assert.match(migrationValidator, /Prisma schema loaded/);
  assert.match(seedValidator, /--read-only/);
  assert.match(seedValidator, /--network none/);
  assert.match(seedValidator, /pnpm \(install\|fetch\)/);
  assert.match(seedValidator, /dist\/seed-fc26-cli\.js/);
  assert.match(seedValidator, /second_counts.*first_counts/s);
  assert.match(seedValidator, /player_ratings/);
  assert.match(seedValidator, /users/);
  assert.match(seedValidator, /matches/);
  assert.match(composeRuntimeValidator, /compose\.base\.yml/);
  assert.match(composeRuntimeValidator, /compose\.automation\.staging\.yml/);
  assert.match(composeRuntimeValidator, /ReadonlyRootfs/);
  assert.match(composeRuntimeValidator, /HostConfig.*Tmpfs/s);
  assert.match(composeRuntimeValidator, /10001:10001/);
  assert.match(composeRuntimeValidator, /Privileged/);
  assert.match(composeRuntimeValidator, /immutable image reference mismatch/);
});

test('migration runtime contains pinned pnpm and bypasses Corepack resolution', async () => {
  const dockerfile = await read('docker/Dockerfile');
  const rootManifest = JSON.parse(await read('package.json'));
  assert.equal(rootManifest.packageManager, 'pnpm@11.9.0');
  assert.match(dockerfile, /npm install --global pnpm@11\.9\.0/);
  assert.match(dockerfile, /test "\$\(pnpm --version\)" = "11\.9\.0"/);
  assert.match(
    dockerfile,
    /ENTRYPOINT \["\/app\/node_modules\/\.bin\/prisma", "migrate", "deploy", "--config", "prisma\.config\.ts"\]/,
  );
  assert.doesNotMatch(dockerfile, /corepack (?:enable|prepare)/);
});

test('Seed runtime executes packaged JavaScript without package-manager mutation', async () => {
  const dockerfile = await read('docker/Dockerfile');
  const seedScript = await read('infra/scripts/seed.sh');
  assert.match(dockerfile, /ENTRYPOINT \["node", "dist\/seed-fc26-cli\.js"\]/);
  assert.doesNotMatch(dockerfile, /ENTRYPOINT \["pnpm", "db:seed:fc26"\]/);
  assert.match(seedScript, /configure_release_images "\$ARENA_RELEASE_DIR" "\$RELEASE_VERSION"/);
  assert.match(seedScript, /bounded redacted diagnostics/);
  assert.match(seedScript, /tail -c 16384/);
  assert.match(seedScript, /exit "\$rc"/);
});

test('Seed Compose validator rejects every security-contract regression', () => {
  assert.equal(validateSeedCompose().status, 0);
  for (const mutate of [
    (service) => delete service.tmpfs,
    (service) => {
      service.tmpfs = ['/var/tmp:rw,noexec,nosuid,size=64m'];
    },
    (service) => {
      service.tmpfs = ['/tmp:rw,nosuid,size=64m'];
    },
    (service) => {
      service.tmpfs = ['/tmp:rw,noexec,size=64m'];
    },
    (service) => {
      service.tmpfs = ['/tmp:rw,noexec,nosuid'];
    },
    (service) => {
      service.read_only = false;
    },
    (service) => {
      service.user = '0:0';
    },
    (service) => {
      service.volumes = [{ type: 'bind', source: '/host/app', target: '/app' }];
    },
    (service) => {
      service.privileged = true;
    },
    (service) => {
      service.command = ['pnpm', 'db:seed:fc26'];
    },
  ]) {
    assert.notEqual(validateSeedCompose(mutate).status, 0);
  }
  assert.notEqual(validateSeedCompose(() => undefined, 'arena-seed:latest').status, 0);
});

test('shell release artifacts are normalized to LF', async () => {
  const attributes = await read('.gitattributes');
  assert.match(attributes, /^\*\.sh text eol=lf$/m);
});

test('uncommitted release candidates are explicit and never presented as final builds', async () => {
  const manifest = JSON.parse(await read('release/manifest.json'));
  if (manifest.buildSha === 'uncommitted') {
    assert.match(manifest.releaseVersion, /-rc\.\d+$/);
    for (const image of images) assert.match(manifest.images[image], /-uncommitted$/);
  }
});

test('cache-independent API and Worker builds remove stale incremental state', async () => {
  for (const app of ['api', 'worker']) {
    const manifest = JSON.parse(await read(`apps/${app}/package.json`));
    assert.match(manifest.scripts.build, /rimraf dist tsconfig\.build\.tsbuildinfo/);
    assert.match(manifest.scripts.clean, /rimraf dist tsconfig\.build\.tsbuildinfo/);
  }
});

test('environment examples do not contain usable production secrets', async () => {
  const files = (await readdir(root)).filter((name) => /^\.env.*\.example$/.test(name));
  for (const file of files) {
    const value = await read(file);
    if (file.includes('production') || file.includes('staging')) {
      assert.doesNotMatch(value, /SESSION_SECRET=(?!REQUIRED|$).+/);
    }
  }
});

test('CI is verification-only and has minimum permissions', async () => {
  const value = await read('.github/workflows/release-verify.yml');
  assert.match(value, /permissions:\s*\n {2}contents: read/);
  assert.match(value, /push: false/);
  assert.doesNotMatch(value, /pull_request_target|docker login|\bssh\b|kubectl|terraform|ansible/i);
  assert.ok(value.indexOf('corepack enable') < value.indexOf('actions/setup-node@v4'));
  assert.ok(value.indexOf('corepack prepare pnpm@11.9.0') < value.indexOf('cache: pnpm'));
});

test('backup and restore tools are opt-in and restore is confirmed', async () => {
  const backup = await read('scripts/database/backup.mjs');
  const restore = await read('scripts/database/restore.mjs');
  assert.match(backup, /--execute/);
  assert.match(backup, /pg_dump/);
  assert.match(restore, /RESTORE_CONFIRM/);
  assert.match(restore, /--exit-on-error/);
});
