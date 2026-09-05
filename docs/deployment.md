# Railway deployment

Phase 0 targets one Railway Next.js service and one Railway PostgreSQL service. Cloudflare R2 and OpenAI remain external server-side providers and are not required by the liveness endpoint.

## Staging setup

1. Push a reviewed branch to GitHub and confirm the `CI` workflow passes.
2. In Railway, create a project with a `staging` environment.
3. Add a PostgreSQL service.
4. Add the GitHub repository as a service and select `railway.json` as its config-as-code file.
5. Add `DATABASE_URL` to the web service as a reference to the PostgreSQL service variable of the same name.
6. Add the remaining server-only variables from the inventory below. Generate new values for every environment; never copy production secrets into preview or staging.
7. Generate a Railway domain and deploy. Railway runs `pnpm db:migrate:deploy` in its pre-deploy container before starting the new application.
8. Confirm `/api/health` returns HTTP 200 with `{ "status": "ok" }`, then smoke the landing route.

The health route is intentionally a process liveness check. It does not call PostgreSQL, R2, or OpenAI, so a provider outage cannot create a restart loop. Database readiness is established by the pre-deploy migration and application-level monitoring introduced with database-backed routes.

## Environment inventory

| Variable               | Phase required | Purpose                                                                                                                                                                          |
| ---------------------- | -------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV=production`  |              0 | Enables production runtime behavior.                                                                                                                                             |
| `DATABASE_URL`         |              0 | Railway PostgreSQL reference variable; server-only.                                                                                                                              |
| `AUTH_SECRET`          |              1 | Auth.js signing/encryption secret.                                                                                                                                               |
| `AUTH_TRUST_HOST=true` |              1 | Explicitly trusts the `Host` header supplied by Railway's managed reverse proxy. Set this only for the Railway service; it must not be enabled for an arbitrary untrusted proxy. |
| `OWNER_EMAIL`          |              1 | One-time owner bootstrap input.                                                                                                                                                  |
| `OWNER_PASSWORD`       |              1 | One-time owner bootstrap input; remove or rotate after use.                                                                                                                      |
| `R2_ACCOUNT_ID`        |              2 | Cloudflare account identifier.                                                                                                                                                   |
| `R2_ACCESS_KEY_ID`     |              2 | R2 server credential.                                                                                                                                                            |
| `R2_SECRET_ACCESS_KEY` |              2 | R2 server credential.                                                                                                                                                            |
| `R2_BUCKET`            |              2 | Object bucket name.                                                                                                                                                              |
| `R2_PUBLIC_BASE_URL`   |              2 | Optional public asset base URL.                                                                                                                                                  |
| `OPENAI_API_KEY`       |              4 | OpenAI server credential.                                                                                                                                                        |
| `OPENAI_IMAGE_MODEL`   |              4 | Image model override; defaults are documented in `.env.example`.                                                                                                                 |
| `OPENAI_TEXT_MODEL`    |              4 | Text model override.                                                                                                                                                             |

Railway supplies `PORT`; do not hard-code it. Auth.js rejects production requests unless the host is trusted: set `AUTH_TRUST_HOST=true` only after the application is deployed behind Railway's managed reverse proxy, which owns the public `Host` header. The application validates this setting as a boolean and passes it explicitly to Auth.js; it never enables host trust by default. No secret may use a `NEXT_PUBLIC_` prefix.

## Deployment behavior

- Build: `pnpm build` through Railpack.
- Pre-deploy: `pnpm db:migrate:deploy` once before the release starts.
- Start: `pnpm start`; Next.js binds to Railway's injected `PORT`.
- Health check: `GET /api/health`, 300-second deployment timeout.
- Restart: on failure, at most three retries.

Do not run migrations from the start command. A failed pre-deploy migration stops the new deployment before traffic switches, while the previous healthy deployment remains available.

## Smoke checklist

```text
GET <staging-url>/api/health -> 200, {"status":"ok"}
GET <staging-url>/api/auth/providers -> 200, credentials provider present
GET <staging-url>/api/auth/session -> 200, null before sign-in
GET <staging-url>/            -> 200, landing heading visible
Railway deployment logs      -> migration applied or no pending migrations
Railway variables            -> no NEXT_PUBLIC_* secret names
```

## Rollback

1. In Railway deployment history, identify the last healthy application deployment.
2. Redeploy that known-good image and wait for `/api/health` to pass before switching traffic.
3. Inspect application and pre-deploy logs.
4. Treat migrations as forward-only. Roll back application code only when the new schema remains backward-compatible; otherwise create and review a corrective migration.
5. Never use `prisma migrate reset` outside the isolated local/CI test database. For destructive production schema incidents, stop writes and follow the backup/restore runbook introduced in Phase 9.

Record the staging URL, deployment ID, migration name, smoke result, and rollback rehearsal result in the release evidence. Production promotion remains blocked until the same artifact passes staging.
