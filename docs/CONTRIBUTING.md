# Contributing

## Development workflow

1. Branch off `main`: `git checkout -b feat/short-name`
2. Make changes; add tests if you added logic.
3. `npm run typecheck && npm run lint && npm test`
4. Open a PR against `main`.

## Invariants — do not violate

1. **Money is integer cents.** Never floats. All money math goes through `dollarsToCents` / `centsToDollars` / `formatCents` from `@bidwright/shared`.
2. **LLMs extract and surface. They don't do arithmetic.** Any dollar-total calculation happens in TypeScript, not in a Claude prompt.
3. **Every extracted field has a `sourcePage`.** Provenance is the moat.
4. **Every AI-generated field has a `confidence` score (0-1) or explicit `null`** (user-entered).
5. **Warnings are surfaced up front.** If Claude wasn't sure, the estimator sees it before anything else.
6. **Zod-validate every LLM output** before it hits the DB or the UI.
7. **Prompts live in `packages/core/src/prompts/`** — never inline.
8. **`claude-sonnet-4-6` is the portfolio default**, but BidWright specifically uses `claude-opus-4-7` for extraction/generation (quality-critical) and `claude-haiku-4-5-20251001` for classification (cheap fast lookups).

## Testing

- `npm test` runs Vitest across all packages.
- Add a fixture PDF to `sample-itbs/` (gitignored) and a corresponding fixture JSON to `packages/core/tests/fixtures/` when adding extraction/generation cases.

## Commit style

Conventional-ish, short:

```
feat(core): add trade classifier
fix(api): handle empty PDF gracefully
docs(readme): update quickstart
chore(deps): bump drizzle-orm
```

## Deploying

Railway. `railway up` from the repo root once `railway.json` is added (Phase 9).
