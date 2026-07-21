# BidWright web — Next.js.
# Build context is the REPO ROOT (web depends on @bidwright/shared).
# On Railway set the service var RAILWAY_DOCKERFILE_PATH=packages/web/Dockerfile.
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/cli/package.json ./packages/cli/
RUN npm ci

COPY tsconfig.json ./
COPY packages/shared ./packages/shared
COPY packages/web ./packages/web

# NEXT_PUBLIC_* is inlined at BUILD time — the API's public URL must be known
# here, so this arg is set when the web service is built (see DEPLOY.md).
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Sequential: web resolves @bidwright/shared through its built .d.ts.
RUN npm run build -w @bidwright/shared \
 && npm run build -w @bidwright/web

ENV NODE_ENV=production
# Railway injects PORT and routes the public domain to it.
CMD ["sh", "-c", "cd packages/web && exec npx next start -p ${PORT:-3000}"]
