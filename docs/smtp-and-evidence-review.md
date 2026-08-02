# SMTP and AI-assisted evidence review

SMTP is provider-neutral and disabled by default. Set `SMTP_ENABLED=true`, host, port, TLS mode,
username, sender and reply-to in inventory. Put only the password in the root-owned
`shared/secrets/SMTP_PASSWORD` file (mode `0600`); runtime uses `SMTP_PASSWORD_FILE`. Never place the
password in inventory or Git. Identity verification and password-reset messages use the existing
outbox and bounded SMTP timeouts. Provider failures are sanitized.

`@arena-core/evidence-review` defines a strict provider-neutral result contract. External upload is
disabled until an operator explicitly configures an adapter. Providers receive only an opaque evidence
id, the allowlisted image, and a bounded claim; no profile, token, DSN or wallet data. Results are
recommendations requiring a human decision. They can never settle, pay, ban, approve, resolve, or alter
ratings. Original evidence follows upload retention; hashes support duplicate detection. Structured
results and sanitized failure metadata should be retained according to the audit retention policy.
