import type { Trade } from "@bidwright/shared";

/**
 * A reusable clause (assumption / clarification / exclusion) seeded for a
 * subcontractor to draw on. Phase 4 layers per-user libraries on top of these
 * seeds, so the shape is deliberately storage-friendly.
 */
export interface ClauseSeed {
  /** Stable slug — safe to reference from saved bids and user templates. */
  id: string;
  text: string;
  /** Trades this clause applies to. Empty means it applies to every trade. */
  trades: Trade[];
}

/**
 * Clauses that apply to a given trade: that trade's own first, then the
 * general ones. Trade-specific clauses lead because callers cap the list —
 * putting them first keeps the most relevant clauses from being cut, and it's
 * the right order for a "most relevant on top" picker UI.
 */
export function forTrade(library: ClauseSeed[], trade: Trade): ClauseSeed[] {
  const specific = library.filter((c) => c.trades.includes(trade));
  const general = library.filter((c) => c.trades.length === 0);
  return [...specific, ...general];
}

/** Just the clause text, for prompt injection. */
export function textsForTrade(library: ClauseSeed[], trade: Trade): string[] {
  return forTrade(library, trade).map((c) => c.text);
}
