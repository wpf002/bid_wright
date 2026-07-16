"use client";

import { History } from "lucide-react";
import { formatCents } from "@bidwright/shared";
import type { CostSuggestion } from "@/lib/api";

/**
 * "You've bid this at $12.50/LF across 4 jobs" — with one click to apply.
 *
 * The number comes from the estimator's own finalized bids, never from the
 * model, so it's a memory aid rather than a guess. A fuzzy match says so
 * explicitly and names the historical item it matched.
 */
export function CostSuggestionBadge({
  suggestion,
  onApply,
  applied,
}: {
  suggestion: CostSuggestion;
  onApply: (cents: number) => void;
  applied: boolean;
}) {
  const { avgUnitCostCents, sampleSize, unit, confidence, matchedDescription, minUnitCostCents, maxUnitCostCents } =
    suggestion;
  const exact = confidence >= 1;
  const spread = maxUnitCostCents - minUnitCostCents;

  const title = [
    exact
      ? `Matched your previous line item exactly.`
      : `Closest match: “${matchedDescription}” (${Math.round(confidence * 100)}% similar).`,
    `Across ${sampleSize} ${sampleSize === 1 ? "job" : "jobs"}.`,
    spread > 0 ? `Range ${formatCents(minUnitCostCents)}–${formatCents(maxUnitCostCents)}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={() => onApply(avgUnitCostCents)}
      title={title}
      aria-label={`Apply ${formatCents(avgUnitCostCents)} per ${unit} from your history`}
      className={`mt-0.5 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] transition-colors ${
        applied
          ? "text-slate-400"
          : exact
            ? "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            : "text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
      }`}
    >
      {/* The unit already has its own column, so repeating it here just forces
          the badge to wrap. Keep this to: price · N jobs. */}
      <History className="h-3 w-3 shrink-0" />
      <span className="whitespace-nowrap font-mono">{formatCents(avgUnitCostCents)}</span>
      <span className="whitespace-nowrap">
        · {sampleSize}
        {exact ? "" : "~"} {sampleSize === 1 ? "job" : "jobs"}
      </span>
    </button>
  );
}
