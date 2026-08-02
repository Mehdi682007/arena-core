# SMTP and AI-assisted evidence review

SMTP is provider-neutral and disabled by default. Set `SMTP_ENABLED=true`, host, port, TLS mode,
username, sender and reply-to in inventory. Put only the password in the root-owned
`shared/secrets/SMTP_PASSWORD` file (mode `0600`); runtime uses `SMTP_PASSWORD_FILE`. Never place the
password in inventory or Git. Identity verification and password-reset messages use the existing
outbox and bounded SMTP timeouts. Provider failures are sanitized.

`@arena-core/evidence-review` is a foundation defining a strict provider-neutral result contract. External upload is
disabled until an operator explicitly configures an adapter. Providers receive only an opaque evidence
id, the allowlisted image, and a bounded claim; no profile, token, DSN or wallet data. Results are
recommendations requiring a human decision. They can never settle, pay, ban, approve, resolve, or alter
ratings. Its in-process cache keys provider, model, MIME type, bounded claim context and bytes.
Runtime validation covers allowlisted MIME types, empty/oversized input, bounded timeout and strict
structured output. It has no persistence, asynchronous Worker integration, Admin UI workflow or
configured external provider. Original evidence follows upload retention; hashes support duplicate detection.
