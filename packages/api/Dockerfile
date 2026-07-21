# BidWright API — Fastify.
# Build context is the REPO ROOT (the API depends on sibling workspaces).
# On Railway set the service var RAILWAY_DOCKERFILE_PATH=packages/api/Dockerfile.
FROM node:20-slim

WORKDIR /app

# Manifests first, so `npm ci` is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/cli/package.json ./packages/cli/
RUN npm ci

# Only the API's dependency chain: shared -> core/db -> api.
COPY tsconfig.json ./
COPY packages/shared ./packages/shared
COPY packages/core ./packages/core
COPY packages/db ./packages/db
COPY packages/api ./packages/api
# Build the workspace libraries so @bidwright/* resolve to their dist (their
# package.json main points there). Chained, not `-w a -w b`: a single
# multi-workspace run can start core before shared finishes emitting.
RUN npm run build -w @bidwright/shared \
 && npm run build -w @bidwright/core \
 && npm run build -w @bidwright/db

ENV NODE_ENV=production
# Run under tsx, not node. The codebase targets tsx: its emitted ESM uses
# extensionless relative imports that plain `node` can't resolve
# (ERR_MODULE_NOT_FOUND). tsx patches resolution and is what dev already runs.
# Migrations run from packages/db so their cwd-relative folder resolves; uploads
# live on a mounted volume (UPLOAD_DIR=/data/uploads), never in the image.
CMD ["sh", "-c", "cd packages/db && npx tsx src/migrate.ts && cd /app && exec npx tsx packages/api/src/index.ts"]
