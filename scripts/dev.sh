#!/usr/bin/env bash
# Single-command dev startup for BidWright
set -e

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "❌ .env not found."
  echo "   Run: cp .env.example .env"
  echo "   Then edit ANTHROPIC_API_KEY"
  exit 1
fi

if ! grep -q "ANTHROPIC_API_KEY=sk-ant-" .env; then
  echo "⚠️  ANTHROPIC_API_KEY looks unset in .env — extraction will fail without it."
fi

echo "🐘 Starting Postgres..."
docker compose up -d

echo "⏳ Waiting for Postgres to accept connections..."
for i in {1..20}; do
  if docker exec bidwright-postgres pg_isready -U bidwright >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if [ ! -d node_modules ]; then
  echo "📦 Installing deps..."
  npm install
fi

echo "🗄️  Running migrations..."
npm run db:migrate 2>&1 || echo "   (no migrations yet — first run will generate them)"

WEB_PORT_VALUE=$(sed -n 's/^WEB_PORT=//p' .env | tail -1)
WEB_PORT_VALUE=${WEB_PORT_VALUE:-3000}

echo ""
echo "✅ Ready. Now run in two terminals:"
echo ""
echo "   Terminal 1:  npm run api:dev    # http://localhost:4000"
echo "   Terminal 2:  npm run web:dev    # http://localhost:${WEB_PORT_VALUE}"
echo ""
