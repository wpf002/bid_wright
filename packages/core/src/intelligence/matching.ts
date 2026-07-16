import type { Trade, Cents } from "@bidwright/shared";

/**
 * Matching a new line item against the user's own cost history.
 *
 * Deliberately deterministic rather than model-based: it runs on every line
 * item of every bid, so it must be instant, free, and reproducible. Embeddings
 * would need a second vendor and a vector store; a Haiku call per line item
 * would add latency and cost to the hot path. Construction line items repeat
 * almost verbatim between bids ("Install EMT conduit for branch circuits"), so
 * normalization plus token overlap covers the real cases — and unlike a model,
 * it can't hallucinate a price.
 */

/** Words that carry no signal for matching a scope item. */
const STOPWORDS = new Set([
  "a", "an", "and", "the", "of", "for", "to", "in", "on", "at", "by", "with",
  "new", "existing", "per", "as", "or", "all", "each", "including", "include",
  "provide", "install", "furnish", "supply", "and/or", "approximately", "approx",
]);

/** Unit aliases seen in real ITBs, mapped to a canonical form. */
const UNIT_ALIASES: Record<string, string> = {
  ea: "EA", each: "EA", pcs: "EA", pc: "EA", unit: "EA",
  lf: "LF", "l.f.": "LF", linft: "LF", "lin ft": "LF",
  sf: "SF", "s.f.": "SF", sqft: "SF", "sq ft": "SF",
  sy: "SY", cy: "CY", cf: "CF",
  ls: "LS", lot: "LS", lumpsum: "LS", "lump sum": "LS",
  hr: "HR", hour: "HR", hrs: "HR",
  day: "DAY", days: "DAY",
  lb: "LB", lbs: "LB", ton: "TON", tons: "TON",
};

/** Canonical unit, so "l.f." and "LF" match. Unknown units pass through upper-cased. */
export function normalizeUnit(unit: string): string {
  const key = unit.trim().toLowerCase().replace(/\s+/g, " ");
  return UNIT_ALIASES[key] ?? unit.trim().toUpperCase();
}

/**
 * Canonical form of a line-item description, used as the match key.
 * Strips punctuation, numbers (quantities/sizes vary bid to bid), and
 * stopwords, then sorts the remaining tokens so word order doesn't matter.
 */
export function normalizeDescription(description: string): string {
  return tokenize(description).sort().join(" ");
}

/** The meaningful tokens of a description. */
export function tokenize(description: string): string[] {
  return description
    .toLowerCase()
    // keep letters/digits, drop everything else
    .replace(/[^a-z0-9\s]/g, " ")
    // a bare number is a quantity or a size — not identity
    .replace(/\b\d+(\.\d+)?\b/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Jaccard similarity over token sets: |A ∩ B| / |A ∪ B|. */
export function similarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Below this, two descriptions are different work and must not share a price. */
export const SIMILARITY_THRESHOLD = 0.6;

export interface CostRecord {
  description: string;
  normalizedKey: string;
  trade: Trade | string;
  unit: string;
  unitCostCents: Cents;
  createdAt: string | Date;
}

export interface CostSuggestion {
  /** Mean of matched historical unit costs, in integer cents. */
  avgUnitCostCents: Cents;
  /** Most recent matched unit cost — what they charged last time. */
  lastUnitCostCents: Cents;
  minUnitCostCents: Cents;
  maxUnitCostCents: Cents;
  /** How many past bids back this suggestion. */
  sampleSize: number;
  unit: string;
  /** 1 for an exact key match; otherwise the best token similarity. */
  confidence: number;
  /** The historical description this matched, for "you bid this as…". */
  matchedDescription: string;
}

interface Candidate {
  record: CostRecord;
  score: number;
}

function toTime(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * Suggest a unit cost for one line item from the user's history.
 *
 * Only history for the same trade and the same canonical unit is eligible —
 * $12.50/LF and $12.50/EA are not interchangeable, and matching across units
 * would produce confidently wrong numbers.
 */
export function suggestCost(
  item: { description: string; unit: string; trade?: Trade | string },
  history: CostRecord[],
): CostSuggestion | null {
  const unit = normalizeUnit(item.unit);
  const key = normalizeDescription(item.description);
  if (!key) return null;

  const eligible = history.filter(
    (h) =>
      normalizeUnit(h.unit) === unit &&
      (item.trade === undefined || h.trade === item.trade),
  );
  if (eligible.length === 0) return null;

  // Exact key matches win outright; otherwise fall back to token overlap.
  const exact = eligible.filter((h) => h.normalizedKey === key);
  let candidates: Candidate[];
  if (exact.length > 0) {
    candidates = exact.map((record) => ({ record, score: 1 }));
  } else {
    candidates = eligible
      .map((record) => ({ record, score: similarity(record.description, item.description) }))
      .filter((c) => c.score >= SIMILARITY_THRESHOLD);
  }
  if (candidates.length === 0) return null;

  // When falling back to fuzzy matches, only keep the best cluster — mixing a
  // 0.9 match with a 0.6 match would drag the average toward different work.
  const best = Math.max(...candidates.map((c) => c.score));
  const kept = candidates.filter((c) => c.score >= best - 0.0001);

  const costs = kept.map((c) => c.record.unitCostCents);
  const newest = kept.reduce((a, b) =>
    toTime(a.record.createdAt) >= toTime(b.record.createdAt) ? a : b,
  );

  return {
    // Integer cents in, integer cents out — never leave a fraction of a cent.
    avgUnitCostCents: Math.round(costs.reduce((a, b) => a + b, 0) / costs.length),
    lastUnitCostCents: newest.record.unitCostCents,
    minUnitCostCents: Math.min(...costs),
    maxUnitCostCents: Math.max(...costs),
    sampleSize: kept.length,
    unit,
    confidence: best,
    matchedDescription: newest.record.description,
  };
}

/** Suggestions for a whole bid, keyed by line item id. Absent = no match. */
export function suggestCostsForItems<T extends { id: string; description: string; unit: string }>(
  items: T[],
  history: CostRecord[],
  trade?: Trade | string,
): Record<string, CostSuggestion> {
  const out: Record<string, CostSuggestion> = {};
  for (const item of items) {
    const suggestion = suggestCost({ ...item, trade }, history);
    if (suggestion) out[item.id] = suggestion;
  }
  return out;
}

/** Build the history row for a priced line item. */
export function toCostRecord(
  item: { description: string; unit: string; unitCostCents: Cents },
  trade: Trade | string,
): Omit<CostRecord, "createdAt"> {
  return {
    description: item.description,
    normalizedKey: normalizeDescription(item.description),
    trade,
    unit: normalizeUnit(item.unit),
    unitCostCents: item.unitCostCents,
  };
}
