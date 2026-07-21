# Deploying BidWright to Railway

Three services in one Railway project: **Postgres**, **api**, **web**. Both app
services build from the repo root via their own Dockerfile
(`packages/api/Dockerfile`, `packages/web/Dockerfile`), both validated with a
local `docker build` + boot before the first deploy.

## Order matters

`NEXT_PUBLIC_API_URL` is inlined into the web bundle **at build time**, so the
API's public URL must exist before web builds. Sequence:

1. **Postgres** — add the database plugin. Railway injects `DATABASE_URL`.
2. **api** — deploy, generate its public domain, then...
3. **web** — set `NEXT_PUBLIC_API_URL` to the api domain, then deploy.

## api service

- Build: `RAILWAY_DOCKERFILE_PATH=packages/api/Dockerfile`
- Variables:
  - `DATABASE_URL` — reference the Postgres service (`${{Postgres.DATABASE_URL}}`)
  - `JWT_SECRET` — a 32+ char random string
  - `ANTHROPIC_API_KEY` — **set this in the dashboard yourself.** Never via CLI.
  - `UPLOAD_DIR=/data/uploads`
  - `INBOUND_WEBHOOK_SECRET` — only if wiring inbound mail
- **Volume:** mount at `/data`. Uploaded PDFs live here; without the volume
  every redeploy wipes them (Railway containers are ephemeral).
- Migrations run automatically on start (`drizzle migrate`, idempotent).
- Railway injects `PORT`; the API listens on it.

## web service

- Build: `RAILWAY_DOCKERFILE_PATH=packages/web/Dockerfile`
- Variables:
  - `NEXT_PUBLIC_API_URL` — the api service's public URL (e.g.
    `https://bidwright-api-production.up.railway.app`). Railway passes it to the
    Dockerfile `ARG` at build time.
- Railway injects `PORT`; `next start` listens on it.

## Demo data (optional)

The app deploys empty — register an account on the live site. To load the demo
data instead, run the seed **inside the api container** (so PDFs land on the
volume, not a local disk):

```
railway run --service api -- sh -c "cd packages/db && npx tsx src/seed/index.ts"
```

## Known follow-ups

- **Image size (~1.8 GB).** Both images carry dev dependencies. A multi-stage
  build with `npm prune --omit=dev` would cut this; deferred since it risks
  removing something the tsx runtime needs.
- **Runs under `tsx`, not compiled `node`.** The emitted ESM uses extensionless
  imports that bare `node` can't resolve; tsx is what dev runs too. Switching to
  a `node`-runnable build (CommonJS emit or explicit extensions) is the
  longer-term fix.
- **Single instance.** The in-process storage sweep and migrate-on-start assume
  one API instance. Scaling out needs both moved to a release/cron step.
