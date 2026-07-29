# Worker service

The Worker loads the same validated `APP_ENV` production policy as the API, logs structured
startup/stopping events, waits for SIGINT/SIGTERM, closes Nest/database resources once, and enforces
a bounded shutdown deadline. It does not run migrations, queues, polling, or schedulers in F8.1.

# Release candidate

Worker `0.1.0-rc.1` is included in the F9.4 configuration, build, shutdown, and notification gates.
