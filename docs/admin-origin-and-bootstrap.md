# Production administrative origin and RBAC bootstrap

Arena Core production is stateful infrastructure. The system seed transactionally upserts the
typed administrative permission catalog and the system `super_admin` role before retaining the
existing FC 26 catalog seed. It preserves custom permissions, roles, and relationships and never
assigns a role to a user.

User assignment is an intentionally separate, audited operator action:

```bash
pnpm admin:bootstrap --email admin@example.com
bash infra/scripts/admin-bootstrap.sh /secure/path/production.env --email admin@example.com
```

An unverified primary email is rejected by default. For an eligible
`PENDING_VERIFICATION` account only, `--verify-email` atomically verifies the intended primary
email, activates the account, assigns the role, and records an append-only audit event. Suspended,
disabled, deleted, unknown, ambiguous, or non-primary users are rejected. The identity domain
policy normalizes the email and audit metadata does not contain it. Role changes can require
logout/login or session refresh.

Production requires distinct `APP_DOMAIN` and `ADMIN_DOMAIN` inventory values and the matching
exact HTTPS `ADMIN_ORIGIN`. Create the admin DNS A record before certificate issuance. Issue or
expand one certificate to both names:

```bash
sudo certbot --nginx --redirect --cert-name "$APP_DOMAIN" \
  -d "$APP_DOMAIN" -d "$ADMIN_DOMAIN"
```

Review Certbot's Nginx diff and run `nginx -t` before reload. The public host returns 404 for
`/admin`; the admin host redirects `/` to `/admin` and permits the local login/session,
static, and backend routes. Arbitrary sibling hosts are rejected.

Sessions remain Secure, HttpOnly, SameSite-protected, and host-only. Public and admin logins are
separate. Do not set a parent-domain cookie for convenience. The hostname is isolation, not the
primary security boundary: authentication, authorization, CSRF validation, rate limits, audit
logging, and secure sessions remain mandatory. MFA is recommended next. Dynamic admin paths are
intentionally unsupported.

Before deployment verify DNS, both certificate SANs, public health, public `/admin` = 404, admin
root redirect, login, and the authenticated panel. On failure restore the previous immutable
application and Nginx release. Database rollback is not automatic; the system seed is idempotent.
