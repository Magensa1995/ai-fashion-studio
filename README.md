# AI Fashion Studio

Private, owner-operated workspace for managing fashion references, generating and editing AI imagery, and preparing social content. The project is a modular monolith built with Next.js App Router and TypeScript.

## Prerequisites

- Node.js 24 or newer
- pnpm 11.19 or newer
- Docker Desktop, or PostgreSQL 16 or newer

## Local setup

1. Install dependencies:

   ```bash
   pnpm install --frozen-lockfile
   ```

2. Start the isolated development database and copy the environment template:

   ```bash
   docker compose up -d postgres
   copy .env.example .env
   ```

   The Compose service listens on port 55432 so it does not conflict with a local PostgreSQL installation. It creates `studio` and an isolated `studio_test` database. Replace non-database placeholders before using their related features. Never expose `DATABASE_URL`, Auth, R2, or OpenAI credentials through a `NEXT_PUBLIC_` variable.

3. Apply migrations and initialize the seed framework:

   ```bash
   pnpm db:migrate:deploy
   pnpm db:seed
   ```

4. Start the development server:

   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

## Quality gates

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Database integration tests require `TEST_DATABASE_URL`. Reset only the isolated test database before running them:

```bash
pnpm db:reset:test
pnpm test
```

Playwright is configured for the critical browser path. Install Chromium once with `pnpm exec playwright install chromium`, then run `pnpm test:e2e`.

## Source boundaries

- `src/app`: routing, layouts, route handlers, and composition only.
- `src/features`: feature-owned business rules, application services, schemas, and UI.
- `src/server`: database, storage, authentication, and AI provider adapters.
- `src/components/ui`: shared shadcn/ui primitives.
- `src/config`: validated server configuration.

Provider SDKs and database clients must stay on the server side. Pages and client components call application services instead of infrastructure directly.

Railway staging setup, environment inventory, smoke checks, and rollback guidance are documented in [`docs/deployment.md`](docs/deployment.md).
