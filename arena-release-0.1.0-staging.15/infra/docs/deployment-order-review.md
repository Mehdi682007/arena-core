# Deployment ordering review

Order: configuration validation → deployment lock → versioned release/Compose validation →
build/pull → dependency startup/readiness → pre-migration backup when an existing DB runs
(mandatory production) → migration lock → one-shot migration → application start/update → health
verification → atomic `current` activation → metadata write → process exit releases locks.

- Failed migration cannot activate the new app.
- Failed health stops the newly started API/Web/Worker and leaves `current` on the previous release;
  the operator must explicitly restart/redeploy the previous version if service continuity is needed.
- Migration runs once per deploy.
- Deployment lock prevents concurrent deploys; migration lock prevents concurrent migrations.
- Versioned previous releases remain available.
- Rollback is possible unless schema compatibility forbids it.
- Migrations are never reversed automatically; incompatible rollback requires a forward fix.
