# Worker service

The Worker loads the same validated `APP_ENV` production policy as the API, logs structured
startup/stopping events, waits for SIGINT/SIGTERM, closes Nest/database resources once, and enforces
a bounded shutdown deadline. It does not run migrations or queue consumers.

RC6 registers staged site-asset cleanup in this existing worker lifecycle. It uses the same
persistent mount as the API, centrally validated retention and interval settings, a PostgreSQL
transaction advisory lock across replicas, and overlap suppression inside one process. Shutdown
stops the schedule and waits for the active run. Only stale canonical files under `.pending` are
eligible; draft and published references are re-read while the distributed lock is held. Per-file
deletion failures are path-redacted and retried by a later idempotent run.

# Release candidate

Worker `0.1.0-rc.1` is included in the F9.4 configuration, build, shutdown, and notification gates.
