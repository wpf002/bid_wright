import { counterparty, type Cents, type OutcomeReason, type OutcomeResult } from "@bidwright/shared";

/**
 * Win/loss analytics.
 *
 * Pure and deterministic — the numbers an estimator uses to decide which GCs
 * are worth chasing shouldn't come from a model, and they need to be
 * reproducible when someone asks "why does it say 40%?".
 *
 * The consistent rule here: **withdrawn bids are excluded from win rate**.
 * A bid you never submitted isn't a loss — counting it as one would punish
 * good no-bid discipline, which is exactly the judgement a busy estimator
 * should be exercising.
 */

export interface AnalyticsBid {
  id: string;
  gcName: string | null;
  /** Public solicitations have no GC, so the agency is the counterparty. */
  ownerName: string | null;
  primaryTrade: string | null;
  status: string;
  subtotalCents: Cents;
  totalCents: Cents;
  createdAt: string | Date;
  outcome?: { result: OutcomeResult; reason?: OutcomeReason; notedAt: string } | null;
}

const MS_PER_DAY = 86_400_000;

function toTime(v: string | Date): number {
  return v instanceof Date ? v.getTime() : new Date(v).getTime();
}

/** Bids with a recorded win or loss — the only ones a win rate can speak to. */
export function decidedBids(bids: AnalyticsBid[]): AnalyticsBid[] {
  return bids.filter((b) => b.outcome?.result === "won" || b.outcome?.result === "lost");
}

export interface WinRate {
  key: string;
  won: number;
  lost: number;
  /** Won / (won + lost). Null when nothing is decided yet. */
  rate: number | null;
  /** Total value of the bids that were won, in integer cents. */
  wonValueCents: Cents;
}

function rateFor(bids: AnalyticsBid[], key: string): WinRate {
  const won = bids.filter((b) => b.outcome?.result === "won");
  const lost = bids.filter((b) => b.outcome?.result === "lost");
  const decided = won.length + lost.length;
  return {
    key,
    won: won.length,
    lost: lost.length,
    rate: decided === 0 ? null : won.length / decided,
    wonValueCents: won.reduce((sum, b) => sum + b.totalCents, 0),
  };
}

/** Group decided bids by a field, then compute a win rate per group. */
function groupRates(
  bids: AnalyticsBid[],
  keyOf: (b: AnalyticsBid) => string | null,
  unknownLabel: string,
): WinRate[] {
  const groups = new Map<string, AnalyticsBid[]>();
  for (const b of decidedBids(bids)) {
    const key = keyOf(b)?.trim() || unknownLabel;
    const list = groups.get(key);
    if (list) list.push(b);
    else groups.set(key, [b]);
  }
  return [...groups.entries()]
    .map(([key, list]) => rateFor(list, key))
    // Most decided bids first — a 100% rate over one bid isn't the headline.
    .sort((a, b) => b.won + b.lost - (a.won + a.lost) || b.wonValueCents - a.wonValueCents);
}

/**
 * Win rate by who you bid to — the GC on private work, the agency on public.
 *
 * Grouping on gcName alone put every public bid in one "Unknown GC" bucket,
 * which hid a real answer ("you win 2 of 3 with the Forest Service") behind a
 * label that implied the data was missing.
 */
export function winRateByCounterparty(bids: AnalyticsBid[]): WinRate[] {
  return groupRates(bids, (b) => counterparty(b)?.name ?? null, "Unknown");
}

export function winRateByTrade(bids: AnalyticsBid[]): WinRate[] {
  return groupRates(bids, (b) => b.primaryTrade, "other");
}

export function overallWinRate(bids: AnalyticsBid[]): WinRate {
  return rateFor(decidedBids(bids), "overall");
}

/**
 * Average days from creating the bid to hearing the outcome.
 * Null when nothing has been decided, rather than a misleading 0.
 */
export function averageBidToAwardDays(bids: AnalyticsBid[]): number | null {
  const spans = decidedBids(bids)
    .map((b) => toTime(b.outcome!.notedAt) - toTime(b.createdAt))
    // Guard against clock skew or a backdated outcome producing a negative.
    .filter((ms) => Number.isFinite(ms) && ms >= 0);
  if (spans.length === 0) return null;
  return spans.reduce((a, b) => a + b, 0) / spans.length / MS_PER_DAY;
}

/**
 * Average markup over cost across priced bids, as a percentage.
 * Only bids with a real subtotal count — an unpriced draft has no margin.
 */
export function averageMarginPercent(bids: AnalyticsBid[]): number | null {
  const priced = bids.filter((b) => b.subtotalCents > 0 && b.totalCents >= b.subtotalCents);
  if (priced.length === 0) return null;
  const margins = priced.map(
    (b) => ((b.totalCents - b.subtotalCents) / b.subtotalCents) * 100,
  );
  return margins.reduce((a, b) => a + b, 0) / margins.length;
}

export interface ReasonCount {
  reason: OutcomeReason;
  count: number;
  share: number;
}

/** Why bids are being lost, most common first. */
export function lossReasons(bids: AnalyticsBid[]): ReasonCount[] {
  const lost = bids.filter((b) => b.outcome?.result === "lost");
  const counts = new Map<OutcomeReason, number>();
  for (const b of lost) {
    const reason = b.outcome?.reason ?? "other";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count, share: count / lost.length }))
    .sort((a, b) => b.count - a.count);
}

export interface TrendPoint {
  /** YYYY-MM */
  month: string;
  won: number;
  lost: number;
  rate: number | null;
}

/**
 * Win rate by month of the outcome date (not the bid date) — the question is
 * "are we winning more lately", which is about when jobs were decided.
 */
export function winRateTrend(bids: AnalyticsBid[]): TrendPoint[] {
  const byMonth = new Map<string, AnalyticsBid[]>();
  for (const b of decidedBids(bids)) {
    const d = new Date(b.outcome!.notedAt);
    if (Number.isNaN(d.getTime())) continue;
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const list = byMonth.get(month);
    if (list) list.push(b);
    else byMonth.set(month, [b]);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, list]) => {
      const r = rateFor(list, month);
      return { month, won: r.won, lost: r.lost, rate: r.rate };
    });
}

export interface CounterpartyHistory {
  name: string;
  kind: "gc" | "owner";
  total: number;
  won: number;
  lost: number;
  pending: number;
  rate: number | null;
}

/**
 * This user's track record with one counterparty — the "you've bid them 3x,
 * won 1x" panel. Matched case-insensitively, since these names arrive from
 * extraction and casing drifts.
 *
 * Compares resolved counterparty to resolved counterparty. Matching the target
 * against gcName alone would silently return null for every public agency.
 */
export function historyWith(
  bids: AnalyticsBid[],
  target: string | null,
): CounterpartyHistory | null {
  const want = target?.trim().toLowerCase();
  if (!want) return null;

  const theirs = bids.filter((b) => counterparty(b)?.name.toLowerCase() === want);
  if (theirs.length === 0) return null;

  const won = theirs.filter((b) => b.outcome?.result === "won").length;
  const lost = theirs.filter((b) => b.outcome?.result === "lost").length;
  const decided = won + lost;
  const resolved = counterparty(theirs[0])!;
  return {
    name: resolved.name,
    kind: resolved.kind,
    total: theirs.length,
    won,
    lost,
    pending: theirs.length - decided - theirs.filter((b) => b.outcome?.result === "withdrawn").length,
    rate: decided === 0 ? null : won / decided,
  };
}

export interface AnalyticsSummary {
  totalBids: number;
  decided: number;
  overall: WinRate;
  byCounterparty: WinRate[];
  byTrade: WinRate[];
  averageBidToAwardDays: number | null;
  averageMarginPercent: number | null;
  lossReasons: ReasonCount[];
  trend: TrendPoint[];
}

export function summarize(bids: AnalyticsBid[]): AnalyticsSummary {
  return {
    totalBids: bids.length,
    decided: decidedBids(bids).length,
    overall: overallWinRate(bids),
    byCounterparty: winRateByCounterparty(bids),
    byTrade: winRateByTrade(bids),
    averageBidToAwardDays: averageBidToAwardDays(bids),
    averageMarginPercent: averageMarginPercent(bids),
    lossReasons: lossReasons(bids),
    trend: winRateTrend(bids),
  };
}
