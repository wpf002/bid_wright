# BidWright — Detailed Roadmap

> AI-powered bid response platform for construction subcontractors. Upload an ITB PDF (scope of work, drawings, specs), get a structured, editable bid response with extracted scope, quantities, deadlines, inclusions/exclusions, bond/insurance requirements, and pre-populated line items, assumptions, and clarifications — in under 5 minutes.

**Repo:** `https://github.com/wpf002/bid_wright.git`
**Deploy target:** Railway
**AI:** Claude Opus 4.7 (extraction + generation), Claude Haiku 4.5 (categorization + fast lookups)

---

## 1. Competitive Landscape (as of July 2026)

The construction bidding software market is crowded but bifurcated. Most tools are GC-first with subs as an afterthought. BidWright is subcontractor-first.

### Direct competitors — features to match

| Competitor | Position | What they do well | Weakness we exploit |
|---|---|---|---|
| **Downtobid** ($119–299/mo for subs) | AI-native, dual-sided | Personalized invites from GC's email, AI scope generation, verified sub database | Expensive; primarily invite-focused (GC-side); response quality is thin |
| **BasisBoard** | Subcontractor bid board | Inbox integration recognizes bid invite emails, zero-data-entry bid board | No AI-generated response, just tracking |
| **ConstructionBids.ai** ($49/mo) | AI enrichment + response gen | Extracts insurance, bonding, DBE, compliance from bid docs; drafts responses from company profile | 250K bid feed is table stakes; response draft is generic; no editor UX |
| **BuildingConnected** ($3,600+/yr) | Enterprise, GC-focused | Autodesk network, huge sub database, structured ITB packages | Sub can only see what GCs invite; no independent workflow; dated UI |
| **PlanHub** (free + paid) | Preconstruction network | Free tier for basic bid tracking, 500K+ professional network | Requires account creation; UI feels dated; response tooling is basic |
| **Procore Bid Management** (enterprise) | GC end-to-end | Full lifecycle, integrations, DocuSign | $50K/yr answer to $500/mo problem; not for subs |
| **iSqFt / ConstructConnect** | Legacy | Massive project database | Old UI; sub adoption reviewers say "estimators look at it and then look at you" |
| **SmartBid** | GC bid coordination | Widely adopted | GC-focused; not sub-first |
| **Melt Bid** | AI bid leveling | Post-receipt scope normalization | GC-side only |

### Features to steal
1. **Inbox integration** — Gmail/Outlook auto-pulls ITB invites (BasisBoard, Downtobid). *Table stakes now.*
2. **AI scope extraction from PDFs** — Downtobid, BasisBoard, ConstructionBids.ai all do this.
3. **Bid board dashboard** — kanban/list of active bids with deadlines and status.
4. **Calendar view** of bid deadlines.
5. **Team assignment** — assign estimators, prevent double-work.
6. **Analytics** — win rate by GC, average bid-to-award time, hot trades.
7. **Auto trade classification / categorization**.
8. **Addenda tracking + alerts** (addendum drops → user is notified, delta highlighted).
9. **No account creation friction** — magic-link or email-only for one-off use.
10. **Verified/enriched contact data** for GCs.

### Features to do better
1. **Subcontractor-first, not sub-as-afterthought.** Every screen, prompt, and workflow assumes the user is a sub responding to an ITB, not a GC managing solicitation.
2. **Response quality over network breadth.** Downtobid competes on network. We compete on the quality of the extraction and the generated response. A startup cannot win a network war; we can win a quality war.
3. **Provenance-first extraction.** Every extracted line item shows the source page and highlighted region in the PDF. If the AI says "Bond required at 10%", the user can click and see the exact clause. This is the trust layer no competitor delivers.
4. **Bid leveling for subs** — help the sub see how their scope compares to typical scope for that trade/project type, based on aggregated (anonymized) response history.
5. **Historical cost intelligence.** Remember unit prices the user has entered before, suggest based on their own history and (opt-in) benchmarks. This is the moat — the data model is the product.
6. **Real estimator workspace.** Not a JSON dump. A line-item editor with drag-to-reorder, inline math, keyboard shortcuts, autosave.
7. **Exclusion language library.** Reusable exclusion clauses per trade, per firm. Grow with every bid.
8. **Post-award tracking.** Win/loss + reasons feed back into next bid's suggestions.
9. **Aggressive pricing.** $49/mo target (undercut Downtobid by 60%), $99/mo pro tier. Free trial: 3 bids, no credit card.
10. **Confidence & warnings surfaced up front.** Every extraction flags what it wasn't sure about. Estimator reviews warnings before line items — matches how estimators actually work.

### UI/UX inspiration
- **Linear** — progressive disclosure, whitespace, Cmd+K command palette
- **Vercel** — dashboard restraint, one primary metric per view
- **Stripe** — professional trust cues, calm density, clean tables
- **Attio** — AI-native surfacing (ranking what deserves attention)
- **Notion** — inline editing, drag-to-reorder blocks
- **Datadog** — dense data when needed, but earned

**Design language for BidWright:**
- Warm neutral palette: slate + amber accent. Amber signals construction subtly, not caricature.
- Inter for UI, JetBrains Mono for numbers and IDs.
- Dark mode + light mode, both first-class.
- Command palette (Cmd+K) from day one.
- Every screen has exactly one primary CTA.
- Confidence badges everywhere. High confidence = green outline. Medium = amber. Warning = red border + reason.

---

## 2. Product Architecture

### The core loop
```
ITB PDF received
  │
  ▼
[Upload / Inbox auto-detect]
  │
  ▼
[Parse PDF] ── pdf-parse ─────────► raw text + page map
  │
  ▼
[Claude Opus 4.7 extraction]
  System prompt: expert estimator, conservative, flag ambiguity
  Output: ProjectMetadata + ScopeItem[] + Compliance + Warnings
  │
  ▼
[Claude Opus 4.7 generation]
  Output: BidResponse (line items, assumptions, clarifications, exclusions)
  │
  ▼
[Editor UI]
  - Line item table with keyboard shortcuts, drag-to-reorder
  - Assumptions / Clarifications / Exclusions side panels
  - PDF viewer with click-through provenance
  - Autosave
  │
  ▼
[Export]
  - Professional PDF proposal (letterhead, terms)
  - Word .docx
  - CSV of line items
  │
  ▼
[Track outcome]
  - Won / Lost / Withdrawn
  - Feedback loop → cost history + suggestions on next bid
```

### Data model (schemas that encode the moat)

- `Bid` — top-level container per ITB response
- `Extraction` — the AI's structured read of the ITB, with per-field `confidence` (0-1) and `sourcePage`
- `ScopeItem` — one line from scope of work; linked to `sourcePage` for provenance
- `LineItem` — user-editable cost line (integer cents for money)
- `Assumption`, `Clarification`, `Exclusion` — reusable text blocks with tags
- `CostHistory` — user's own history of unit costs per description, per trade, per region
- `ExclusionClause` — reusable exclusion library per user
- `Outcome` — won / lost / withdrawn + reason (feeds ML later)
- `Provenance` — every AI-extracted field links back to (page, char range) in source PDF

**Money is always integer cents (BigInt).** No floats. Standard invariant across the portfolio.

### Stack

| Layer | Tech |
|---|---|
| Package manager | pnpm workspaces + Turborepo |
| Language | TypeScript (strict) |
| Backend | Fastify 4 |
| DB | PostgreSQL 16 + Drizzle ORM |
| Frontend | Next.js 14 App Router + Tailwind + shadcn/ui pattern |
| AI | Anthropic SDK — Opus 4.7 (extraction/generation), Haiku 4.5 (classification) |
| PDF parsing | pdf-parse + pdfjs-dist (for rendering) |
| Auth | Custom JWT (HS256, refresh rotation, bcrypt) |
| Payments | Stripe (deferred to Phase 6) |
| Email inbox | Nylas or IMAP direct (Phase 5) |
| Deployment | Railway (Nixpacks) |
| CI | GitHub Actions |
| Testing | Vitest |

---

## 3. Roadmap by Phase

Each phase has: **goal**, **build**, **exit criteria**, **git commit tag**.

### Phase 0 — Repo bootstrap & initial commit *(this delivery)*
**Goal:** Full monorepo scaffold pushed to `github.com/wpf002/bid_wright.git` with running infrastructure.

**Build:**
- 6-package monorepo (shared, core, db, api, web, cli)
- Root configs (tsconfig, eslint, prettier, turbo, docker-compose)
- Fastify API skeleton with health check + upload route
- Next.js 14 web skeleton with professional landing page + dashboard shell
- Drizzle schema (bids, extractions, line_items, cost_history, exclusion_clauses, outcomes)
- Claude extraction + generation prompts (v1, conservative)
- CLI for local testing (`bidwright extract`, `bidwright bid`)
- `bash dev.sh` single-command dev startup
- README + this ROADMAP + CONTRIBUTING
- CI (typecheck, lint, test on push)
- Initial commit + push

**Exit criteria:**
- `bash dev.sh` starts Postgres + installs + migrates without errors
- `npm run api:dev` starts on :4000
- `npm run web:dev` starts on :3000, renders landing page
- CI green on first push
- `git log` shows initial commit on `main`, pushed to origin

**Tag:** `v0.1.0-scaffold`

---

### Phase 1 — Core extraction pipeline (Week 1-2)
**Goal:** PDF in → structured extraction out, with provenance.

**Build:**
- Full pdf-parse + pdfjs-dist page mapping (every extracted line knows its source page)
- Extraction prompt v2: page-anchored, conservative, warns on ambiguity, per-field confidence
- Zod schemas for extraction validation (retry on parse failure)
- Trade classifier using Haiku 4.5 (cheap + fast)
- 20+ unit tests on real ITB text fixtures
- CLI: `bidwright extract file.pdf --json` returns validated ExtractionResult

**Exit criteria:**
- 5 real public ITBs from SAM.gov / state portals extract without errors
- Extraction schema round-trips through Zod validation
- Per-field confidence scores are populated
- Every scope item has a `sourcePage`

**Tag:** `v0.2.0-extraction`

---

### Phase 2 — Bid response generation (Week 2-3)
**Goal:** Structured extraction → drafted bid response with line items, assumptions, clarifications, exclusions.

**Build:**
- Generation prompt v2: trade-aware, conservative on quantities, flags anything requiring sub input
- Line item generation with `unitCost: 0` and `confidence: null` (user fills in)
- Assumption library seed: 50+ common assumptions per trade
- Clarification library: 30+ common GC questions per trade
- Exclusion library: 40+ standard exclusions per trade
- Money: integer cents (BigInt) end-to-end
- 20+ unit tests

**Exit criteria:**
- CLI `bidwright bid file.pdf -o bid.json` produces a valid `BidResponse`
- Generated response has ≥5 line items, ≥3 assumptions, ≥3 clarifications, ≥5 exclusions
- All money fields are integer cents

**Tag:** `v0.3.0-generation`

---

### Phase 3 — Web UI: Bid Board + Editor (Week 3-5)
**Goal:** Professional, intuitive UI a working estimator would actually want to use.

**Build:**
- **Landing page** — hero, feature grid, pricing, testimonials placeholder, footer. Warm slate + amber palette. Inter typeface. Framer-motion micro-interactions.
- **Auth** — email + password, JWT + refresh rotation, magic link login option
- **Bid Board (dashboard)** — table view of all bids. Columns: project, GC, trade, deadline (with countdown), status, assigned to, last touched. Sortable, filterable. Empty state that walks a first-time user through their first upload.
- **Calendar view** — bid deadlines in a month/week grid.
- **Kanban view** — status columns (Draft, In Review, Submitted, Won, Lost).
- **New Bid flow** — drag-drop PDF, processing state with real progress ("Reading pages…" → "Extracting scope…" → "Generating response…"), redirect to editor.
- **Bid Editor** — split view:
  - Left: PDF viewer (pdfjs-dist), page thumbnails, jump-to-source on any extracted field
  - Right: tabbed editor — Overview | Line Items | Assumptions | Clarifications | Exclusions | Compliance
  - Line item table: inline edit, drag-to-reorder, keyboard shortcuts (Tab/Enter/Cmd+Enter), autosave every 2s
  - Confidence badges (green/amber/red) on every AI-generated field
  - "Warnings" banner at top listing anything the AI wasn't sure about
- **Command palette** (Cmd+K) — search bids, jump to sections, create new bid, keyboard-first
- **Export** — PDF proposal (with user's letterhead), Word .docx, CSV
- Dark mode + light mode toggle, respects system

**UI stack:**
- Next.js 14 App Router
- Tailwind CSS + shadcn/ui component patterns
- `lucide-react` for icons
- `pdfjs-dist` for PDF rendering
- `framer-motion` for micro-interactions
- `sonner` for toasts
- `zod` + `react-hook-form` for validation

**Exit criteria:**
- First-time user can upload a PDF and produce an editable bid in under 3 minutes without help text
- Editor autosaves; no data loss on refresh
- PDF click-through provenance works (click a scope item → PDF scrolls to the source page)
- Cmd+K opens command palette, closes on Esc, navigable by arrow keys
- Lighthouse Performance ≥ 90 on landing page
- Mobile-responsive (bid board readable on iPhone 14)

**Tag:** `v0.4.0-ui`

---

### Phase 4 — Historical cost intelligence + libraries (Week 5-6)
**Goal:** BidWright gets smarter the more the user uses it.

**Build:**
- `CostHistory` table populated on every finalized bid
- On new bid, generation prompt is enriched with user's own historical unit costs for matching line items (semantic match via embeddings or Haiku classification)
- **Assumption / Clarification / Exclusion libraries** — user's own reusable clauses, per trade, one-click insert
- **Templates** — save a bid's assumption/clarification/exclusion set as a reusable template per trade
- **Cost suggestion badge** on each line item: "You've bid this at $12.50/LF on 4 previous jobs (avg)"

**Exit criteria:**
- Second bid for the same trade is faster than the first (measurable time-to-first-price)
- Cost suggestions appear on ≥50% of line items after 5 bids in the same trade

**Tag:** `v0.5.0-intelligence`

---

### Phase 5 — Inbox integration (Week 6-8)
**Goal:** ITBs auto-appear in the user's bid board without upload.

**Build:**
- Nylas or direct IMAP (research trade-offs — Nylas is faster to ship, IMAP is cheaper)
- OAuth flow for Gmail + Outlook (Microsoft 365)
- Rule engine: detect ITB emails by heuristics (subject keywords, sender domain, attachment types) + Haiku classification
- Auto-download PDF attachments, run extraction, land in bid board as "New"
- Notification: "3 new bids landed in your inbox this morning"

**Exit criteria:**
- Connect Gmail once → next ITB from a known GC lands as a Draft bid within 5 minutes
- Zero false positives on non-ITB email in 100-email test set

**Tag:** `v0.6.0-inbox`

---

### Phase 6 — Payments, plans, billing (Week 8-9)
**Goal:** Charge from day one.

**Build:**
- Stripe integration (Elements + webhooks)
- Plans:
  - **Free trial:** 3 bids, no credit card
  - **Solo — $49/mo:** 25 bids/mo, 1 seat
  - **Team — $99/mo:** unlimited bids, 3 seats, inbox integration
  - **Firm — $249/mo:** 10 seats, historical cost intelligence, cost export API
- Metered usage tracking
- Billing portal
- Trial → paid conversion flow

**Exit criteria:**
- Successful Stripe test-mode purchase → account upgraded, quota enforced
- Webhook signature verification working
- Trial expiry gates access without data loss

**Tag:** `v0.7.0-billing`

---

### Phase 7 — Export polish + proposal PDFs (Week 9-10)
**Goal:** The exported proposal looks better than what the sub was producing in Excel.

**Build:**
- Upload company letterhead + brand color
- Proposal template engine (react-pdf or Puppeteer HTML → PDF)
- Cover page, executive summary, scope narrative, line item table, assumptions/clarifications/exclusions, terms, signature block
- .docx export via `docx` package
- CSV of line items
- Preview + download

**Exit criteria:**
- Exported PDF renders correctly on Mac Preview, Adobe Acrobat, Chrome
- Company letterhead appears on every page
- Long line item tables paginate correctly

**Tag:** `v0.8.0-export`

---

### Phase 8 — Outcome tracking + analytics (Week 10-11)
**Goal:** Close the loop. Learn from wins and losses.

**Build:**
- Bid outcome UI: Won / Lost / Withdrawn + reason (too high, too low, scope mismatch, GC choice, timing)
- Analytics dashboard: win rate by GC, win rate by trade, average bid-to-award time, average bid margin, top-losing scope categories
- "Similar bid" panel on new bids: "You bid this GC 3x this year, won 1x"

**Exit criteria:**
- Analytics dashboard renders with real user data after 10 completed bids
- Win-rate trend is visible

**Tag:** `v0.9.0-analytics`

---

### Phase 9 — Deployment + first users (Week 11-12)
**Goal:** Live, hardened, ready for the first 10 users.

**Build:**
- Railway deployment (web + api + Postgres)
- Custom domain (`bidwright.app` or similar) + SSL
- Sentry error tracking
- PostHog product analytics
- Rate limiting + basic abuse protection
- Backup / restore procedures documented
- Legal: Terms of Service, Privacy Policy, GDPR-style data export/delete
- Onboarding email sequence
- Public landing page with real testimonials (after first 5 users)

**Exit criteria:**
- Live at production URL
- Sentry receiving events
- 5 real users onboarded, at least 1 paying

**Tag:** `v1.0.0`

---

## 4. Kill criteria — when to stop

Be honest. Kill BidWright if:

1. **After 20 real ITBs tested (Phase 1):** extraction accuracy on scope of work is < 80% (measured against manual estimator review).
2. **After Phase 3 launch:** no user completes a full bid without abandoning the session on their first try, after 10 attempted users.
3. **After Phase 6 (billing):** conversion from trial → paid is < 5% after 50 trial users.
4. **After Phase 9 (launch):** cannot reach 10 paying subscribers within 3 months of paid launch.

Kill criteria are not for the LLM to enforce. They're for the operator to be honest about.

---

## 5. Immediate next actions

**Now (Phase 0 delivery — this zip):**
1. Push initial scaffold to `github.com/wpf002/bid_wright.git` (commands below)
2. Verify `bash dev.sh` runs clean locally

**Week 1 (starts Phase 1):**
1. Grab 10 public ITBs from SAM.gov (federal), Texas SmartBuy, City of Dallas Procurement, NCTRCA
2. Run each through `bidwright extract` via CLI, review extraction quality manually
3. Iterate on the extraction prompt until 8/10 are clean
4. Write extraction test fixtures based on these

**Week 2:**
1. Same drill on generation prompt with the 10 ITBs
2. Line-item quality review

**Week 3-5:**
1. Full editor UI build
2. First internal use — Will personally responds to a public ITB using BidWright end to end
3. If the exported response is defensibly professional, ready for external testers

---

## 6. Repo push commands

```bash
# Unzip and cd
unzip bidwright.zip -d bid_wright && cd bid_wright

# Git is already initialized with the initial commit.
# Verify:
git log --oneline

# Create the repo on GitHub (via gh CLI):
gh repo create wpf002/bid_wright --private \
  --description "AI-powered bid response platform for construction subcontractors" \
  --source=. --remote=origin

# Or manually create at https://github.com/new, then:
git remote add origin https://github.com/wpf002/bid_wright.git

# Push:
git push -u origin main
```

The initial commit is authored as `Will Foti <wpf002@github.com>`. Adjust before pushing if needed:

```bash
git commit --amend --author="Your Name <you@example.com>" --no-edit
```
