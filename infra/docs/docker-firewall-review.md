# Docker and firewall review

Published automation ports are only `127.0.0.1:3000` (Web) and `127.0.0.1:3001` (API). PostgreSQL,
Worker, migrate, and seed have no host ports; Redis is absent. Internal networks are `app` and
`data`. NGINX is the only public application entrypoint on IPv4/IPv6 80 and later 443.

Docker may bypass UFW forwarding for public publications. Isolation does not rely on UFW alone:
container ports are kernel-bound to loopback and no database publication exists. A `DOCKER-USER`
baseline preserves established and loopback traffic without disrupting internal Docker networks.
Docker restart does not change bind addresses. Verification checks 5432 and Docker API 2375/2376.
Provider firewall and actual IPv6 behavior remain VPS runtime checks.
The automation publishes API and Web only on host loopback and publishes no PostgreSQL port. UFW
protects host ingress. The DOCKER-USER rules accept established traffic and loopback traffic, then
return to Docker's own chains; they provide a stable policy hook but do not impose a blanket drop.
This is deliberate because an unqualified drop can break container egress and bridge networking.
Runtime verification must confirm that only the reverse proxy is externally reachable.
