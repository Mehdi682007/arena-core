# @arena-core/email

Framework-neutral outbound email boundary for Arena Core. It owns immutable message contracts,
safe typed delivery errors, FA/EN identity templates, opaque-token URL construction, an in-memory
test sender, and the SMTP adapter. Nest lifecycle and identity orchestration remain in the API.

The SMTP transport is created once, connects lazily on send, can be explicitly verified by the
application startup policy, and is closed during shutdown. Delivery errors expose only stable codes;
credentials, message bodies, and tokens are never included.

Local development uses Mailpit at `127.0.0.1:1025`. SMTP is disabled by default, and no sender may
silently replace SMTP with an in-memory delivery path at runtime.
