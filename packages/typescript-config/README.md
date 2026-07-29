# `@arena-core/typescript-config`

Shared strict TypeScript configurations:

- `base.json`: framework-neutral strict defaults.
- `node.json`: Node.js packages and services.
- `nextjs.json`: future Next.js application settings.
- `nestjs.json`: NestJS settings with decorator metadata and CommonJS output for predictable Node runtime behavior.

`skipLibCheck` is enabled deliberately to avoid third-party declaration incompatibilities; project source remains fully strict and independently type-checked.
