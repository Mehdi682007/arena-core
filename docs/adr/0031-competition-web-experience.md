# ADR-0031: Competition Web experience

Status: Accepted

F9.2 composes existing catalog, game-account, matchmaking, match, result, evidence, dispute,
finance, rating, and notification projections in authenticated App Router pages. State
transitions remain server-authoritative. Refresh is manual rather than background polling.

The existing public default-ruleset read was minimally extended with an optional validated
`modeKey`, because selecting both FC 26 modes otherwise could not produce the required ruleset ID.
No domain behavior or database schema changed.

Evidence remains declaration-only, finance remains explicitly non-monetary, and notification
navigation uses an allowlisted registry. Realtime transport, uploads, payments, and admin
operations remain excluded.
