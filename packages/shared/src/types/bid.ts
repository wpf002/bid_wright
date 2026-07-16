import type { ExtractionResult } from "./extraction";
import type { Cents } from "./money";

export type BidStatus =
  | "draft" | "in_review" | "submitted" | "won" | "lost" | "withdrawn";

export interface BidLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitCostCents: Cents;
  totalCostCents: Cents;
  notes: string | null;
  sourcePage: number | null;
  confidence: number | null;
}

export type OutcomeResult = "won" | "lost" | "withdrawn";

/**
 * Why a bid ended the way it did. Constrained rather than free text because
 * these feed the analytics — "top losing categories" only works if the answers
 * are comparable across bids.
 */
export type OutcomeReason =
  | "price_too_high"
  | "price_too_low"
  | "scope_mismatch"
  | "gc_chose_other"
  | "timing"
  | "no_bid_submitted"
  | "other";

export const OUTCOME_REASON_LABELS: Record<OutcomeReason, string> = {
  price_too_high: "Our price was too high",
  price_too_low: "We left money on the table",
  scope_mismatch: "Scope mismatch",
  gc_chose_other: "GC went with someone else",
  timing: "Timing / availability",
  no_bid_submitted: "We didn't submit",
  other: "Other",
};

/** Reasons that only make sense for a loss. */
export const LOSS_REASONS: OutcomeReason[] = [
  "price_too_high",
  "scope_mismatch",
  "gc_chose_other",
  "timing",
  "other",
];

export interface BidOutcome {
  result: OutcomeResult;
  reason?: OutcomeReason;
  /** Free-text colour the estimator adds; never parsed, only displayed. */
  notes?: string | null;
  notedAt: string;
}

export interface BidResponse {
  id: string;
  itbFileName: string;
  status: BidStatus;
  createdAt: string;
  updatedAt: string;
  extraction: ExtractionResult;
  lineItems: BidLineItem[];
  assumptions: string[];
  clarifications: string[];
  exclusions: string[];
  subtotalCents: Cents;
  overheadPercent: number;
  profitPercent: number;
  totalCents: Cents;
  validityDays: number;
  outcome?: BidOutcome;
}
