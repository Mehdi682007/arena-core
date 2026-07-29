# ADR 0013: Email delivery and identity templates

- Status: Accepted
- Date: 2026-07-25

## Context

Identity verification and password reset need real delivery while preserving the transport-neutral
identity domain, opaque-token handling, enumeration resistance, and a local Mailpit workflow.

## Decision

Create `@arena-core/email` as the framework-neutral message, template, URL, sender-port, and SMTP
adapter package. Nodemailer is the only transport dependency. The API owns Nest wiring, one
long-lived SMTP sender, startup verification policy, shutdown, and the identity dispatcher.

SMTP is disabled by default. Local development targets loopback Mailpit without credentials.
Staging and production configuration is validated centrally. Required delivery verifies the
transport during startup; optional delivery connects lazily. The API never switches silently to an
in-memory sender.

Registration commits independently of delivery and reports `deliveryStatus: pending` after a typed
delivery failure. Verification and password-reset requests retain identical `202` responses on
typed delivery failures to prevent account enumeration. URLs are built with the platform URL API,
templates escape untrusted values, and delivery errors contain stable codes rather than secrets,
tokens, addresses, bodies, or provider diagnostics.

Queueing, retries, an outbox, Redis/BullMQ, provider APIs, webhook processing, and identity UI are
deferred.

## Consequences

The current direct SMTP send is intentionally single-attempt and not transactionally atomic with
identity persistence. Operators can choose fail-fast startup only when delivery is required.
Production still needs a later provider/retry/outbox decision, bounce handling, observability
metrics, and operational runbooks.
