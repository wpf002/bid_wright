# BidWright

**AI-powered bid response platform for construction subcontractors.**

Upload an ITB PDF, get a structured, editable bid response with extracted scope, quantities, deadlines, inclusions/exclusions, bond/insurance requirements, and pre-populated line items — turning a 2–4 hour manual estimating process into a 5-minute review.

Repo: `https://github.com/wpf002/bid_wright.git`

---

## Quick start

```bash
git clone https://github.com/wpf002/bid_wright.git
cd bid_wright
cp .env.example .env
# → edit .env, set ANTHROPIC_API_KEY

bash scripts/dev.sh
# Then in two terminals:
npm run api:dev    # http://localhost:4000
npm run web:dev    # http://localhost:3000
```

## What's in the box

```
bid_wright/
├── packages/
│   ├── shared/     # Types (Trade, ExtractionResult, BidResponse, money)
│   ├── core/       # Extraction + generation logic (Claude Opus 4.7)
│   ├── db/         # Drizzle schema + migrations (Postgres 16)
│   ├── api/        # Fastify REST API (auth, uploads, bids)
│   ├── web/        # Next.js 14 web app (App Router, Tailwind)
│   └── cli/        # `bidwright extract` / `bidwright bid` for local testing
├── scripts/
│   ├── dev.sh              # Single-command dev startup
│   └── setup-github.sh     # Git init + repo create + push
├── sample-itbs/    # Drop test PDFs here
├── docker-compose.yml
├── ROADMAP.md      # Full 10-phase roadmap through v1.0
└── docs/
    └── CONTRIBUTING.md
```

## Stack

- **TypeScript** (strict) — npm workspaces monorepo
- **Fastify 4** — API
- **Next.js 14** App Router + **Tailwind CSS** + shadcn/ui pattern — web
- **PostgreSQL 16** + **Drizzle ORM**
- **Anthropic SDK** — `claude-opus-4-7` (extraction + generation), `claude-haiku-4-5-20251001` (classification)
- **pdf-parse** — PDF ingestion
- **Vitest** — testing
- **Railway** — deploy target

## CLI

Test extraction locally without spinning up the web app:

```bash
# Extract only
npx bidwright extract sample-itbs/downtown-office.pdf --pretty

# Full bid response
npx bidwright bid sample-itbs/downtown-office.pdf -o bid.json --pretty
```

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full 10-phase build plan through v1.0, including competitive analysis and kill criteria.

**Current phase:** 0 (scaffold + initial commit)

## License

Proprietary — © 2026 Will Foti / BidWright.
