# User Web journeys

| Route                                                  | Access                                          | Integration                                     |
| ------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------------- |
| `/`                                                    | Public                                          | Static product foundation                       |
| `/login`, `/register`                                  | Public; authenticated users leave for dashboard | Identity login/register                         |
| `/forgot-password`, `/reset-password`, `/verify-email` | Public                                          | Existing anti-enumeration and token endpoints   |
| `/leaderboards`                                        | Public                                          | FC 26 1v1/2v2 leaderboard                       |
| `/dashboard`                                           | Authenticated                                   | Session, profile, ratings, latest notifications |
| `/profile`                                             | Authenticated                                   | Profile read/update and onboarding summary      |
| `/notifications`                                       | Authenticated                                   | Page, read/unread, archive, load more           |
| `/settings`                                            | Authenticated                                   | Notification preferences and logout             |

Forms provide browser-compatible autocomplete, field and form errors, pending states, password
visibility, and safe request IDs. Passwords are never trimmed, logged, analyzed, or placed in
storage. Notification bodies are rendered as text React children, never injected HTML.

Matchmaking, match rooms, result/dispute flows, wallet operations, game account management,
uploads, realtime transport, admin UI, payments, and deployment remain outside F9.1.

# Support operator journey

An authenticated operator enters `/admin`; the server obtains the current allowlisted
capabilities and shows only permitted sections. The operator can inspect immutable audit events,
perform explicit bounded search, review user or match timelines, inspect safe notification
delivery state, confirm retry/recovery operations, and manually refresh diagnostics. Permission
failure or service unavailability fails closed and never produces synthetic data.
