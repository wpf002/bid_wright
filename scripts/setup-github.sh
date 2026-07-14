#!/usr/bin/env bash
# One-shot GitHub setup: creates repo, adds remote, pushes.
# Prereq: `gh auth login` completed OR create the repo manually first.
set -e

REPO_URL="https://github.com/wpf002/bid_wright.git"

echo "🔧 Configuring git for wpf002/bid_wright..."

# If not already a git repo, init
if [ ! -d .git ]; then
  git init -q
  git branch -M main
fi

# Create repo if it doesn't exist
if command -v gh >/dev/null 2>&1; then
  if ! gh repo view wpf002/bid_wright >/dev/null 2>&1; then
    gh repo create wpf002/bid_wright --private \
      --description "AI-powered bid response platform for construction subcontractors" \
      || echo "(repo may already exist — continuing)"
  fi
else
  echo "⚠️  gh CLI not installed. Create the repo manually at:"
  echo "    https://github.com/new  (name: bid_wright, private)"
  read -p "Press enter when the empty repo exists..."
fi

# Add or set remote
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

# Stage + commit if nothing committed yet
if ! git log >/dev/null 2>&1; then
  git add .
  git commit -q -m "Initial commit: BidWright monorepo scaffold

- 6-package pnpm/npm workspace monorepo
- Fastify API + Next.js 14 web + Drizzle/Postgres + Anthropic SDK
- Extraction + generation prompts (Claude Opus 4.7)
- Professional UI: landing, bid board, editor (progressive disclosure)
- CLI for local testing
- CI, dev.sh single-command startup
- Roadmap through v1.0"
fi

git push -u origin main

echo ""
echo "✅ Pushed to $REPO_URL"
echo "   Visit: https://github.com/wpf002/bid_wright"
