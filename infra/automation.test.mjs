import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const infra = path.dirname(fileURLToPath(import.meta.url));
const scripts = path.join(infra, 'scripts');
const required = [
  'bootstrap-remote.sh',
  'bootstrap.sh',
  'provision.sh',
  'host-preflight.sh',
  'install-security.sh',
  'install-docker.sh',
  'install-firewall.sh',
  'install-fail2ban.sh',
  'install-updates.sh',
  'configure-time.sh',
  'configure-swap.sh',
  'configure-sysctl.sh',
  'create-operator-user.sh',
  'configure-ssh.sh',
  'install-reverse-proxy.sh',
  'prepare-directories.sh',
  'prepare-runtime-env.sh',
  'deploy.sh',
  'migrate.sh',
  'seed.sh',
  'admin-bootstrap.sh',
  'verify.sh',
  'status.sh',
  'logs.sh',
  'backup.sh',
  'install-release.sh',
  'restore.sh',
  'rollback.sh',
];

test('all automation entrypoints use Bash strict mode', async () => {
  for (const name of required) {
    const source = await readFile(path.join(scripts, name), 'utf8');
    assert.match(source, /^#!\/usr\/bin\/env bash\r?\nset -Eeuo pipefail/m, name);
  }
});

test('automation contains no prohibited destructive or secret-bearing patterns', async () => {
  const files = (await readdir(scripts, { recursive: true }))
    .filter((name) => name.endsWith('.sh') && name !== 'validate-framework.sh')
    .map((name) => path.join(scripts, name));
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  assert.doesNotMatch(
    source,
    /git clean|git reset --hard|docker compose down -v|chmod 777|curl.*\|\s*(ba)?sh|PermitRootLogin yes|PasswordAuthentication yes\s*# final/i,
  );
  assert.doesNotMatch(source, /sshpass\s+-p|POSTGRES_PASSWORD=[A-Za-z0-9]{12,}/);
  assert.match(source, /operator-key-verified/);
  assert.match(source, /sshd -t/);
});

test('inventory contracts distinguish users and permit domainless staging', async () => {
  const staging = await readFile(path.join(infra, 'inventory/staging.env.example'), 'utf8');
  const production = await readFile(path.join(infra, 'inventory/production.env.example'), 'utf8');
  assert.match(staging, /APP_DOMAIN=\r?\n/);
  assert.match(staging, /ENABLE_TLS=false/);
  for (const key of ['SERVER_INITIAL_USER', 'SERVER_OPERATOR_USER', 'SERVER_APP_USER']) {
    assert.match(staging, new RegExp(`^${key}=`, 'm'));
  }
  assert.match(production, /ENABLE_TLS=true/);
  assert.match(production, /ADMIN_DOMAIN=\r?\n/);
  assert.match(staging, /^DEPLOY_MODE=prebuilt$/m);
  assert.match(production, /^DEPLOY_MODE=prebuilt$/m);
  assert.doesNotMatch(`${staging}\n${production}`, /(PASSWORD|SECRET|TOKEN)=\S+/);
});

test('runtime environment generator emits the complete canonical API contract', async () => {
  const runtime = await readFile(path.join(scripts, 'prepare-runtime-env.sh'), 'utf8');
  for (const entry of [
    'LOG_LEVEL=info',
    'HOST=0.0.0.0',
    'API_PORT=3001',
    'API_PREFIX=/api/v1',
    'CORS_ENABLED=false',
    'WORKER_SHUTDOWN_TIMEOUT_MS=10000',
    'WEB_PORT=3000',
    'NEXT_PUBLIC_DEFAULT_LOCALE=fa',
  ]) {
    const escaped = entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(runtime, new RegExp(escaped + '\\\\n'), entry);
  }
  assert.match(
    runtime,
    /AUTH_ALLOWED_ORIGINS=%s:\/\/%s,%s:\/\/%s\\nIDENTITY_PUBLIC_BASE_URL=%s:\/\/%s\\n/,
  );
  assert.match(runtime, /ADMIN_ORIGIN=%s:\/\/%s\\nADMIN_DOMAIN=%s\\n/);
  assert.match(runtime, /API_BASE_URL=%s:\/\/%s\/api\/v1\\n/);
  assert.doesNotMatch(runtime, /API_BASE_URL=%s:\/\/%s\/api\\n/);

  const format = runtime.match(
    /printf '(WEB_PORT=3000\\nNEXT_PUBLIC_APP_NAME=Arena\\\\ Core\\nNEXT_PUBLIC_DEFAULT_LOCALE=fa\\n)'/,
  )?.[1];
  assert.ok(format, 'source contains the canonical Web runtime printf format');
  assert.doesNotMatch(format, /\\\\n|\\n\/$/);

  const directory = await mkdtemp(path.join(os.tmpdir(), 'arena-runtime-env-'));
  const output = path.join(directory, 'runtime.env');
  const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash';
  try {
    const generated = spawnSync(bash, ['-c', "printf '" + format + "'"], {
      encoding: 'utf8',
    });
    assert.equal(generated.status, 0, generated.stderr);
    assert.equal(
      generated.stdout,
      'WEB_PORT=3000\nNEXT_PUBLIC_APP_NAME=Arena\\ Core\nNEXT_PUBLIC_DEFAULT_LOCALE=fa\n',
    );
    await writeFile(output, generated.stdout);
    const syntax = spawnSync(bash, ['-n', output], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr);
    const sourced = spawnSync(
      bash,
      ['-c', 'source "$1" && printf "%s" "$NEXT_PUBLIC_APP_NAME"', 'bash', output],
      { encoding: 'utf8' },
    );
    assert.equal(sourced.status, 0, sourced.stderr);
    assert.equal(sourced.stdout, 'Arena Core');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Web runtime port and canonical variables remain consistent through deployment', async () => {
  const runtime = await readFile(path.join(scripts, 'prepare-runtime-env.sh'), 'utf8');
  const config = await readFile(path.join(infra, '../packages/config/src/index.ts'), 'utf8');
  const compose = await readFile(path.join(infra, 'compose/compose.base.yml'), 'utf8');
  const nginx = await readFile(path.join(scripts, 'install-reverse-proxy.sh'), 'utf8');
  const verify = await readFile(path.join(scripts, 'verify.sh'), 'utf8');
  const dockerfile = await readFile(path.join(infra, '../docker/Dockerfile'), 'utf8');
  assert.match(
    runtime,
    /WEB_PORT=3000\\nNEXT_PUBLIC_APP_NAME=Arena\\\\ Core\\nNEXT_PUBLIC_DEFAULT_LOCALE=fa\\n/,
  );
  assert.match(config, /requiredValue\(source, 'WEB_PORT', '3000'/);
  assert.match(compose, /arena-web:[\s\S]*ports: \['127\.0\.0\.1:3000:3000'\]/);
  assert.match(compose, /env_file:[\s\S]*ARENA_ENV_FILE/);
  assert.match(nginx, /s\/\{\{WEB_PORT\}\}\/3000\/g/);
  assert.match(verify, /wait_for_http arena-web http:\/\/127\.0\.0\.1:3000\/api\/health/);
  assert.match(dockerfile, /ENV PORT=3000[\s\S]*EXPOSE 3000/);
});

test('proxy health is a non-sensitive exact contract shared by nginx and verification', async () => {
  const verify = await readFile(path.join(scripts, 'verify.sh'), 'utf8');
  for (const template of ['domain.conf.template', 'staging-ip.conf.template']) {
    const nginx = await readFile(path.join(infra, 'nginx', template), 'utf8');
    assert.match(nginx, /listen 127\.0\.0\.1:8088;/);
    assert.match(
      nginx,
      /location = \/arena-proxy-health \{ default_type text\/plain; return 200 "ok\\n"; \}/,
    );
    assert.doesNotMatch(nginx, /arena-proxy-health[\s\S]{0,120}(stub_status|auth|env|version)/i);
  }
  assert.match(verify, /http:\/\/127\.0\.0\.1:8088\/arena-proxy-health/);
  assert.match(verify, /\[\[ "\$proxy_body" != ok \]\]/);
  assert.match(verify, /--resolve "\$proxy_host:443:127\.0\.0\.1"/);
});

test('production nginx isolates the exact public and admin hosts', async () => {
  const nginx = await readFile(path.join(infra, 'nginx/domain.conf.template'), 'utf8');
  const installer = await readFile(path.join(scripts, 'install-reverse-proxy.sh'), 'utf8');
  const verify = await readFile(path.join(scripts, 'verify.sh'), 'utf8');
  assert.match(nginx, /server_name \{\{APP_DOMAIN\}\}/);
  assert.match(nginx, /server_name \{\{ADMIN_DOMAIN\}\}/);
  assert.match(nginx, /location = \/admin \{ return 404; \}/);
  assert.match(nginx, /location \^~ \/admin\/ \{ return 404; \}/);
  assert.match(nginx, /location = \/ \{ return 302 \/admin; \}/);
  assert.match(installer, /\{\{ADMIN_DOMAIN\}\}/);
  assert.match(verify, /public admin concealment/);
  assert.match(verify, /TLS certificate does not cover both domains/);
});

test('activation verification has bounded API, Web, and Worker readiness', async () => {
  const verify = await readFile(path.join(scripts, 'verify.sh'), 'utf8');
  assert.match(
    verify,
    /VERIFY_READINESS_TIMEOUT_SECONDS="\$\{VERIFY_READINESS_TIMEOUT_SECONDS:-120\}"/,
  );
  assert.match(
    verify,
    /VERIFY_READINESS_INTERVAL_SECONDS="\$\{VERIFY_READINESS_INTERVAL_SECONDS:-2\}"/,
  );
  assert.match(verify, /while \(\( SECONDS - started < VERIFY_READINESS_TIMEOUT_SECONDS \)\)/);
  assert.match(
    verify,
    /wait_for_http arena-api http:\/\/127\.0\.0\.1:3001\/api\/v1\/health\/ready/,
  );
  assert.match(verify, /wait_for_http arena-web http:\/\/127\.0\.0\.1:3000\/api\/health/);
  assert.match(verify, /wait_for_worker \|\| status=FAIL/);
  assert.match(verify, /state.*exited.*dead.*restarts/s);
  assert.match(verify, /compose logs --no-color --tail 80/);
  assert.match(verify, /tail -c "\$VERIFY_DIAGNOSTIC_MAX_BYTES"/);
  assert.match(verify, /\[REDACTED\]/);
});

test('failed readiness preserves activation invariants and successful readiness emits no evidence', async () => {
  const deploy = await readFile(path.join(scripts, 'deploy.sh'), 'utf8');
  const verify = await readFile(path.join(scripts, 'verify.sh'), 'utf8');
  const verifyCall = deploy.indexOf('if ! "$SCRIPT_DIR/verify.sh" "$inventory"; then');
  const currentWrite = deploy.lastIndexOf(
    'ln -sfn "$ARENA_RELEASE_DIR" "$SERVER_APP_ROOT/current"',
  );
  const metadataWrite = deploy.lastIndexOf('record_deployment "$RELEASE_VERSION" active');
  assert.ok(verifyCall >= 0 && verifyCall < currentWrite && currentWrite < metadataWrite);
  assert.match(
    deploy,
    /compose stop arena-api arena-worker arena-web[\s\S]*no previous release was available/,
  );
  assert.match(deploy, /rollback-after-failed-deploy/);
  assert.ok(
    verify.indexOf('service_diagnostics "$service"') > verify.indexOf('did not become ready'),
  );
  assert.doesNotMatch(verify, /VERIFY_REPORT.*failure|failure-evidence/);
});

test('deployment mode is explicit and unknown values are rejected', async () => {
  const validation = await readFile(path.join(scripts, 'lib/validation.sh'), 'utf8');
  assert.match(validation, /\$\{DEPLOY_MODE:\?DEPLOY_MODE required\}/);
  assert.match(validation, /DEPLOY_MODE.*prebuilt.*build-local/);
  assert.doesNotMatch(validation, /DEPLOY_MODE:-/);
});

test('Compose exposes only loopback Web/API and keeps database private', async () => {
  const compose = await readFile(path.join(infra, 'compose/compose.base.yml'), 'utf8');
  assert.match(compose, /ingress:\r?\n\s+driver: bridge/);
  assert.match(compose, /com\.docker\.network\.bridge\.host_binding_ipv4: '127\.0\.0\.1'/);
  assert.match(compose, /arena-api:[\s\S]*?networks: \[ingress, app, data\]/);
  assert.match(compose, /arena-web:[\s\S]*?networks: \[ingress, app\]/);
  assert.match(compose, /arena-worker:[\s\S]*?image:/);
  assert.doesNotMatch(
    compose.match(/arena-worker:[\s\S]*?(?=\n  arena-web:)/)?.[0] ?? '',
    /ingress/,
  );
  assert.doesNotMatch(
    compose.match(/postgres:[\s\S]*?(?=\n  arena-migrate:)/)?.[0] ?? '',
    /ingress/,
  );
  assert.match(compose, /app: \{ internal: true \}/);
  assert.match(compose, /data: \{ internal: true \}/);
  assert.match(compose, /127\.0\.0\.1:3001:3001/);
  assert.match(compose, /127\.0\.0\.1:3000:3000/);
  assert.doesNotMatch(compose, /5432:5432/);
  assert.doesNotMatch(compose, /\bprivileged:|network_mode:\s*host|image:\s*\S+:latest/);
  assert.match(compose, /POSTGRES_PASSWORD_FILE/);
});

test('real deployment path enforces the exact Seed Compose runtime contract', async () => {
  const compose = await readFile(path.join(infra, 'compose/compose.base.yml'), 'utf8');
  const composeLibrary = await readFile(path.join(scripts, 'lib/compose.sh'), 'utf8');
  const deploy = await readFile(path.join(scripts, 'deploy.sh'), 'utf8');
  const seed = await readFile(path.join(scripts, 'seed.sh'), 'utf8');
  const service = compose.match(/  arena-seed:[\s\S]*?(?=\nnetworks:)/)?.[0] ?? '';
  assert.match(service, /image: \$\{ARENA_SEED_IMAGE/);
  assert.match(service, /tmpfs: \['\/tmp:rw,noexec,nosuid,size=64m'\]/);
  assert.doesNotMatch(service, /privileged:|docker\.sock|\/app:/);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /user: '10001:10001'/);
  assert.match(composeLibrary, /validate_seed_compose_contract\(\)/);
  assert.match(composeLibrary, /validate-seed-compose\.py/);
  assert.ok(
    deploy.indexOf('validate_seed_compose_contract') <
      deploy.indexOf('if [[ "$DRY_RUN" == true ]]'),
  );
  assert.ok(seed.indexOf('validate_seed_compose_contract') < seed.indexOf('acquire_lock'));
});

test('lifecycle operations are locked and destructive operations confirmed', async () => {
  for (const name of ['deploy.sh', 'migrate.sh', 'backup.sh', 'restore.sh', 'rollback.sh']) {
    assert.match(await readFile(path.join(scripts, name), 'utf8'), /acquire_lock/, name);
  }
  assert.match(await readFile(path.join(scripts, 'restore.sh'), 'utf8'), /RESTORE_CONFIRM/);
  assert.match(await readFile(path.join(scripts, 'rollback.sh'), 'utf8'), /ROLLBACK_CONFIRM/);
});

test('deployment and migration share one trap-released lifecycle lock', async () => {
  const common = await readFile(path.join(scripts, 'lib/common.sh'), 'utf8');
  const deploy = await readFile(path.join(scripts, 'deploy.sh'), 'utf8');
  const migrate = await readFile(path.join(scripts, 'migrate.sh'), 'utf8');
  assert.match(common, /LOCK_FDS=\(\)/);
  assert.match(common, /trap release_locks EXIT/);
  assert.match(common, /LOCK_FDS\+=\("\$fd"\)/);
  assert.doesNotMatch(common, /\bLOCK_FD=/);
  assert.match(deploy, /run\/deploy\.lock/);
  assert.match(migrate, /run\/deploy\.lock/);
  assert.doesNotMatch(deploy, /run\/migrate\.lock/);
});

test('dry-run exits before locks, backups, and runtime mutation', async () => {
  const deploy = await readFile(path.join(scripts, 'deploy.sh'), 'utf8');
  const provision = await readFile(path.join(scripts, 'provision.sh'), 'utf8');
  const common = await readFile(path.join(scripts, 'lib/common.sh'), 'utf8');
  assert.ok(deploy.indexOf('if [[ "$DRY_RUN" == true ]]') < deploy.indexOf('acquire_lock'));
  assert.match(provision, /\[\[ "\$DRY_RUN" == true \]\] \|\| backup_system_configuration/);
  assert.match(common, /if \[\[ "\$DRY_RUN" == true \]\]; then[\s\S]*DRY-RUN: acquire lock/);
  assert.match(common, /DRY-RUN: write managed file/);
  for (const name of ['backup.sh', 'migrate.sh', 'seed.sh']) {
    const source = await readFile(path.join(scripts, name), 'utf8');
    assert.match(source, /DRY_RUN[\s\S]*no lock/);
  }
  assert.match(await readFile(path.join(scripts, 'verify.sh'), 'utf8'), /no report written/);
});

test('clean-host dry-run bypasses user-dependent filesystem operations', async () => {
  for (const name of ['create-operator-user.sh', 'prepare-directories.sh']) {
    const source = await readFile(path.join(scripts, name), 'utf8');
    assert.match(source, /"\$DRY_RUN" == true[\s\S]*! id "\$SERVER_/);
    assert.match(source, /exit 0/);
  }
  assert.match(
    await readFile(path.join(scripts, 'install-docker.sh'), 'utf8'),
    /DRY-RUN:[\s\S]*exit 0/,
  );
  assert.match(
    await readFile(path.join(scripts, 'host-preflight.sh'), 'utf8'),
    /DRY-RUN: preflight result/,
  );
});

test('orchestrators do not depend on executable bits preserved by an archive', async () => {
  const provision = await readFile(path.join(scripts, 'provision.sh'), 'utf8');
  const bootstrap = await readFile(path.join(scripts, 'bootstrap.sh'), 'utf8');
  assert.match(provision, /bash "\$SCRIPT_DIR\/host-preflight\.sh"/);
  assert.match(provision, /bash "\$SCRIPT_DIR\/\$step\.sh"/);
  assert.match(provision, /bash "\$SCRIPT_DIR\/configure-ssh\.sh"/);
  assert.match(bootstrap, /exec bash "\$script_dir\/provision\.sh"/);
});

test('optional reboot notice cannot fail strict-mode update installation', async () => {
  const updates = await readFile(path.join(scripts, 'install-updates.sh'), 'utf8');
  assert.match(updates, /if \[\[ -f \/var\/run\/reboot-required \]\]/);
  assert.doesNotMatch(updates, /\[\[ -f \/var\/run\/reboot-required \]\] &&/);
});

test('reverse proxy safely disables only the packaged default-site symlink', async () => {
  const nginx = await readFile(path.join(scripts, 'install-reverse-proxy.sh'), 'utf8');
  assert.match(nginx, /\[\[ -L \/etc\/nginx\/sites-enabled\/default \]\]/);
  assert.match(nginx, /run unlink \/etc\/nginx\/sites-enabled\/default/);
  assert.doesNotMatch(nginx, /rm .*sites-enabled\/default/);
});

test('SSH hardening precedes cloud-init drop-ins and removes the obsolete managed file', async () => {
  const ssh = await readFile(path.join(scripts, 'configure-ssh.sh'), 'utf8');
  assert.match(ssh, /00-arena-hardening\.conf/);
  assert.match(ssh, /unlink \/etc\/ssh\/sshd_config\.d\/99-arena-hardening\.conf/);
});

test('failed deployment and manual rollback restore and verify an application release', async () => {
  const deploy = await readFile(path.join(scripts, 'deploy.sh'), 'utf8');
  const rollback = await readFile(path.join(scripts, 'rollback.sh'), 'utf8');
  assert.match(deploy, /rollback-after-failed-deploy/);
  assert.match(deploy, /previous release restored and verified/);
  assert.match(deploy, /for service in arena-migrate arena-api arena-worker arena-web; do/);
  assert.match(deploy, /if compose build "\$service"; then/);
  assert.match(rollback, /compose up -d arena-api arena-worker arena-web/);
  assert.match(rollback, /manual-rollback/);
  assert.match(rollback, /previous release restored and verified/);
  assert.match(rollback, /configure_release_images "\$target" "\$2"/);
  assert.match(rollback, /configure_release_images "\$current" "\$current_version"/);
});

test('prebuilt deployment validates before mutation and never falls back to local build', async () => {
  const deploy = await readFile(path.join(scripts, 'deploy.sh'), 'utf8');
  const images = await readFile(path.join(scripts, 'lib/images.sh'), 'utf8');
  const base = await readFile(path.join(infra, 'compose/compose.base.yml'), 'utf8');
  const local = await readFile(path.join(infra, 'compose/compose.build-local.yml'), 'utf8');
  assert.ok(deploy.indexOf('configure_release_images') < deploy.indexOf('acquire_lock'));
  assert.ok(deploy.indexOf('validate_registry_credentials') < deploy.indexOf('acquire_lock'));
  assert.match(deploy, /if \[\[ "\$DEPLOY_MODE" == build-local \]\]/);
  assert.match(deploy, /pull_and_verify_prebuilt_images/);
  assert.doesNotMatch(base, /^\s+build:/m);
  assert.equal((local.match(/^\s+build:/gm) ?? []).length, 5);
  assert.match(
    images,
    /for reference in \\\s+"\$ARENA_MIGRATE_IMAGE" "\$ARENA_API_IMAGE" "\$ARENA_WORKER_IMAGE" "\$ARENA_WEB_IMAGE" \\\s+"\$ARENA_SEED_IMAGE"/,
  );
  assert.match(images, /docker pull "\$reference" \|\| die/);
  assert.match(images, /expected_repo_digest="\$name@\$digest"/);
  assert.match(images, /pulled image RepoDigest mismatch/);
  assert.match(images, /org\.opencontainers\.image\.revision/);
  assert.match(images, /org\.opencontainers\.image\.version/);
  assert.match(images, /pulled image revision label mismatch/);
  assert.match(images, /pulled image version label mismatch/);
  assert.doesNotMatch(images, /pnpm|turbo|compose build/);
});

test('prebuilt registry authentication is optional, secret-file based, and ephemeral', async () => {
  const deploy = await readFile(path.join(scripts, 'deploy.sh'), 'utf8');
  const images = await readFile(path.join(scripts, 'lib/images.sh'), 'utf8');
  assert.match(deploy, /docker login[\s\S]*--password-stdin/);
  assert.match(deploy, /DOCKER_CONFIG="\$registry_config"/);
  assert.match(deploy, /cleanup_registry_config/);
  assert.doesNotMatch(deploy, /echo .*(TOKEN|PASSWORD)/i);
  assert.match(images, /unsafe registry token permissions/);
});

test('prebuilt migration and release metadata retain exact image references', async () => {
  const deploy = await readFile(path.join(scripts, 'deploy.sh'), 'utf8');
  assert.match(deploy, /compose run --no-deps --rm arena-migrate/);
  assert.match(deploy, /"imageManifestSha256"/);
  for (const variable of [
    'ARENA_MIGRATE_IMAGE',
    'ARENA_API_IMAGE',
    'ARENA_WORKER_IMAGE',
    'ARENA_WEB_IMAGE',
    'ARENA_SEED_IMAGE',
  ]) {
    assert.match(deploy, new RegExp(`\\$${variable}`));
  }
});

test('database lifecycle supports container and external PostgreSQL', async () => {
  for (const name of ['backup.sh', 'restore.sh', 'verify.sh']) {
    const source = await readFile(path.join(scripts, name), 'utf8');
    assert.match(source, /POSTGRES_MODE.*container/, name);
    assert.match(source, /DATABASE_DIRECT_URL/, name);
  }
  const backup = await readFile(path.join(scripts, 'backup.sh'), 'utf8');
  assert.match(backup, /BACKUP_MIN_FREE_MB/);
  assert.match(backup, /find \. -type f ! -name SHA256SUMS/);
  assert.match(backup, /cleanup_partial/);
  assert.match(backup, /source "\$SCRIPT_DIR\/lib\/images\.sh"/);
  assert.match(backup, /configure_release_images "\$ARENA_RELEASE_DIR" "\$RELEASE_VERSION"/);
  assert.match(backup, /pg_restore -l/);
  assert.ok(backup.indexOf('configure_release_images') < backup.indexOf('compose config --quiet'));
  assert.ok(backup.indexOf('compose config --quiet') < backup.indexOf('acquire_lock'));
  assert.ok(backup.indexOf('configure_release_images') < backup.indexOf('pg_dump'));
  const restore = await readFile(path.join(scripts, 'restore.sh'), 'utf8');
  assert.ok(
    restore.indexOf('compose stop arena-api') <
      restore.indexOf('if [[ "$POSTGRES_MODE" == container ]]'),
  );
  const composeLibrary = await readFile(path.join(scripts, 'lib/compose.sh'), 'utf8');
  assert.match(composeLibrary, /POSTGRES_MODE:-container/);
  assert.match(composeLibrary, /--profile container-db/);
  for (const overlay of [
    'compose/compose.automation.staging.yml',
    'compose/compose.automation.production.yml',
  ]) {
    assert.match(await readFile(path.join(infra, overlay), 'utf8'), /depends_on: !reset \{\}/);
  }
});

test('external PostgreSQL utility containers use the stable Docker host gateway', async () => {
  for (const name of ['backup.sh', 'restore.sh', 'monitor.sh', 'verify.sh']) {
    const source = await readFile(path.join(scripts, name), 'utf8');
    for (const invocation of source.match(/docker run[^\n]*(?:\\\r?\n[^\n]*)?/g) ?? []) {
      if (invocation.includes('postgres:17.10-alpine3.23')) {
        assert.match(invocation, /--add-host host\.docker\.internal:host-gateway/, name);
      }
    }
  }
  assert.doesNotMatch(await readFile(path.join(scripts, 'backup.sh'), 'utf8'), /172\.17\.0\.1/);
});

test('backup ownership follows the effective user and never requires non-root chown', async () => {
  const backup = await readFile(path.join(scripts, 'backup.sh'), 'utf8');
  const permissions = await readFile(path.join(scripts, 'lib/backup-permissions.sh'), 'utf8');
  assert.match(backup, /secure_backup_tree "\$partial"/);
  assert.match(permissions, /if \(\(EUID == 0\)\)/);
  assert.match(permissions, /chmod 0700/);
  assert.match(permissions, /chmod 0600/);
  assert.doesNotMatch(backup, /chown -R root:root "\$partial"/);
  assert.match(backup, /-w "\$candidate"/);
});

test('release archive identity is validated before immutable installation', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'arena-archive-'));
  const releaseId = '0.1.0-production.test';
  const buildSha = 'a'.repeat(40);
  const archive = path.join(directory, `arena-release-${releaseId}.tar.gz`);
  const release = path.join(directory, 'fixture', 'release');
  const validator = path.join(scripts, 'validate-release-archive.py');
  const python =
    process.env.ARENA_TEST_PYTHON ??
    (process.platform === 'win32'
      ? path.join(
          os.homedir(),
          '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',
        )
      : 'python3');
  try {
    await mkdir(release, { recursive: true });
    await writeFile(
      path.join(release, 'manifest.json'),
      JSON.stringify({ releaseVersion: releaseId, buildSha }),
    );
    await writeFile(
      path.join(release, 'deployment-images.json'),
      JSON.stringify({ releaseId, sourceCommit: buildSha }),
    );
    const packed = spawnSync('tar', [
      '-czf',
      archive,
      '-C',
      path.join(directory, 'fixture'),
      'release',
    ]);
    assert.equal(packed.status, 0);
    const checksum = createHash('sha256')
      .update(await readFile(archive))
      .digest('hex');
    const valid = spawnSync(python, [validator, archive, releaseId, buildSha, checksum]);
    assert.equal(valid.status, 0);
    const stale = spawnSync(python, [
      validator,
      archive,
      '0.1.0-production.other',
      buildSha,
      checksum,
    ]);
    assert.notEqual(stale.status, 0);
    const wrongSha = spawnSync(python, [validator, archive, releaseId, 'b'.repeat(40), checksum]);
    assert.notEqual(wrongSha.status, 0);
    const installer = await readFile(path.join(scripts, 'install-release.sh'), 'utf8');
    assert.ok(installer.indexOf('validate_release_archive') < installer.indexOf('mkdir -m 0750'));
    assert.match(
      installer,
      /release directory already exists; immutable release will not be overwritten/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('logging and status redact common credentials', async () => {
  const logs = await readFile(path.join(scripts, 'logs.sh'), 'utf8');
  assert.match(logs, /redacted/i);
  assert.doesNotMatch(logs, /(?:^|\n)\s*(?:env|printenv)\s|set -x/);
});

test('operations timers are bounded, persistent, and repository managed', async () => {
  const backupTimer = await readFile(path.join(infra, 'systemd/arena-backup.timer'), 'utf8');
  const backupService = await readFile(path.join(infra, 'systemd/arena-backup.service'), 'utf8');
  const monitorTimer = await readFile(path.join(infra, 'systemd/arena-monitor.timer'), 'utf8');
  const monitorService = await readFile(path.join(infra, 'systemd/arena-monitor.service'), 'utf8');
  assert.match(backupTimer, /OnCalendar=\*-\*-\* 03:00:00/);
  assert.match(backupTimer, /Persistent=true/);
  assert.match(backupService, /ARENA_INVENTORY_FILE/);
  assert.match(backupService, /backup\.sh \$\{ARENA_INVENTORY_FILE\}/);
  assert.match(backupService, /stat -c %%u/);
  assert.match(monitorTimer, /OnUnitActiveSec=5m/);
  assert.match(monitorService, /TimeoutStartSec=2m/);
  assert.match(monitorService, /NoNewPrivileges=true/);
});

test('monitoring and SMTP secrets are opt-in and file-backed', async () => {
  const monitor = await readFile(path.join(scripts, 'monitor.sh'), 'utf8');
  const inventory = await readFile(path.join(infra, 'inventory/monitoring.env.example'), 'utf8');
  const runtime = await readFile(path.join(scripts, 'prepare-runtime-env.sh'), 'utf8');
  assert.match(inventory, /TELEGRAM_ALERTS_ENABLED=false/);
  assert.match(inventory, /ARENA_INVENTORY_FILE=\/etc\/arena\/production\.env/);
  assert.match(monitor, /\[REDACTED\]/);
  assert.match(monitor, /timeout --signal=TERM/);
  assert.match(monitor, /compose ps -q|bounded_compose ps -q/);
  assert.match(monitor, /\.State\.Status/);
  assert.match(monitor, /\.RestartCount/);
  assert.match(monitor, /\.State\.Health/);
  assert.doesNotMatch(monitor, /docker inspect "arena-(api|web|worker)"/);
  for (const check of [
    'public-api',
    'public-web',
    'admin-web',
    'public-admin-concealment',
    'backup-stale',
    'backup-checksum',
    'tls-expiry',
    'systemd-failed-units',
    'current-release',
  ])
    assert.match(monitor, new RegExp(check));
  assert.match(monitor, /mktemp "\$state_dir\/\.alert-state/);
  assert.match(monitor, /notification_ok/);
  assert.match(runtime, /SMTP_PASSWORD_FILE=\/run\/arena-secrets\/SMTP_PASSWORD/);
  assert.doesNotMatch(runtime, /printf ['"]SMTP_PASSWORD=/);
});

test('backup retention validates successful archives and never removes partial or newest backup', async () => {
  const backup = await readFile(path.join(scripts, 'backup.sh'), 'utf8');
  assert.match(backup, /BACKUP_RETENTION_DAYS:-14/);
  assert.match(backup, /BACKUP_CLEANUP_LIMIT:-100/);
  assert.match(backup, /! -name '\*\.partial'/);
  assert.match(backup, /candidate.*!=.*target/);
  assert.match(backup, /sha256sum -c SHA256SUMS/);
  assert.match(backup, /pg_restore -l/);
  assert.match(backup, /deleted < cleanup_limit/);
  assert.ok(backup.indexOf('mv "$partial" "$target"') < backup.indexOf('for candidate'));
  assert.match(backup, /run\/deploy\.lock/);
  assert.match(backup, /run\/backup\.lock/);
});

test('container monitoring rejects representative exited, unhealthy and restart-loop states', () => {
  const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash';
  const library = path.join(scripts, 'lib/monitoring.sh').replaceAll('\\', '/');
  const evaluate = (service, state, health, restarts, threshold = 1) =>
    spawnSync(
      bash,
      [
        '-c',
        'source "$1"; container_state_is_acceptable "$2" "$3" "$4" "$5" "$6"',
        'bash',
        library,
        service,
        state,
        health,
        String(restarts),
        String(threshold),
      ],
      { encoding: 'utf8' },
    ).status;
  assert.equal(evaluate('arena-api', 'running', 'healthy', 0), 0);
  assert.equal(evaluate('arena-web', 'exited', 'healthy', 0), 1);
  assert.equal(evaluate('arena-api', 'running', 'unhealthy', 0), 1);
  assert.equal(evaluate('arena-worker', 'running', 'none', 2), 1);
  assert.equal(evaluate('arena-worker', 'running', 'none', 0), 0);
});
