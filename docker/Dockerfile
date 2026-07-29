# syntax=docker/dockerfile:1.7
FROM node:24.14.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install --global pnpm@11.9.0 && test "$(pnpm --version)" = "11.9.0"
WORKDIR /workspace

FROM base AS dependencies
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM dependencies AS builder
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV DATABASE_DIRECT_URL=postgresql://build:build@127.0.0.1:5432/build
RUN pnpm exec turbo run build --env-mode=loose

FROM builder AS deploy-api
RUN pnpm --filter @arena-core/api deploy --prod --legacy /output/api

FROM builder AS deploy-worker
RUN pnpm --filter @arena-core/worker deploy --prod --legacy /output/worker

FROM builder AS deploy-database
RUN pnpm --filter @arena-core/database deploy --legacy /output/database

FROM builder AS deploy-seed
RUN pnpm --filter @arena-core/game-catalog deploy --legacy /output/seed

FROM node:24.14.0-bookworm-slim AS runtime
ARG BUILD_SHA=unknown
ARG RELEASE_VERSION=0.0.0
LABEL org.opencontainers.image.revision=$BUILD_SHA \
      org.opencontainers.image.version=$RELEASE_VERSION \
      org.opencontainers.image.source="Arena Core repository"
ENV NODE_ENV=production
RUN groupadd --gid 10001 arena && useradd --uid 10001 --gid arena --no-create-home --shell /usr/sbin/nologin arena
WORKDIR /app
USER 10001:10001

FROM runtime AS api
COPY --from=deploy-api --chown=10001:10001 /output/api/ ./
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "/healthchecks/http.mjs", "http://127.0.0.1:3001/api/v1/health"]
COPY --chown=10001:10001 docker/healthchecks /healthchecks
CMD ["node", "dist/main.js"]

FROM runtime AS worker
COPY --from=deploy-worker --chown=10001:10001 /output/worker/ ./
COPY --chown=10001:10001 docker/healthchecks /healthchecks
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "/healthchecks/process.mjs", "dist/main.js"]
CMD ["node", "dist/main.js"]

FROM runtime AS web
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder --chown=10001:10001 /workspace/apps/web/.next/standalone ./
COPY --from=builder --chown=10001:10001 /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --chown=10001:10001 docker/healthchecks /healthchecks
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "/healthchecks/http.mjs", "http://127.0.0.1:3000/health"]
CMD ["node", "apps/web/server.js"]

FROM base AS job-runtime
ARG BUILD_SHA=unknown
ARG RELEASE_VERSION=0.0.0
LABEL org.opencontainers.image.revision=$BUILD_SHA \
      org.opencontainers.image.version=$RELEASE_VERSION \
      org.opencontainers.image.source="Arena Core repository"
ENV NODE_ENV=production
RUN groupadd --gid 10001 arena && useradd --uid 10001 --gid arena --no-create-home --shell /usr/sbin/nologin arena
WORKDIR /app
USER 10001:10001

FROM job-runtime AS migrate
COPY --from=deploy-database --chown=10001:10001 /output/database/ ./
COPY --from=builder --chown=10001:10001 /workspace/packages/database/prisma ./prisma
COPY --from=builder --chown=10001:10001 /workspace/packages/database/prisma.config.ts ./prisma.config.ts
ENTRYPOINT ["/app/node_modules/.bin/prisma", "migrate", "deploy", "--config", "prisma.config.ts"]

FROM job-runtime AS seed
COPY --from=deploy-seed --chown=10001:10001 /output/seed/ ./
ENTRYPOINT ["pnpm", "db:seed:fc26"]
