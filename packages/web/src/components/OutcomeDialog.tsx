"use client";

import { useState } from "react";
import { Trophy, X, Loader2 } from "lucide-react";
import { OUTCOME_REASON_LABELS, LOSS_REASONS, type OutcomeReason, type OutcomeResult } from "@bidwright/shared";
import type { BidOutcome } from "@/lib/api";

/**
 * Capture how a bid ended.
 *
 * The reason is the point: "we lost" is a fact, "we lost on price four times
 * running with this GC" is the thing that changes the next bid. Reasons are a
 * fixed set so they aggregate.
 */
export function OutcomeDialog({
  current,
  onSave,
  onClose,
}: {
  current: BidOutcome | null;
  onSave: (outcome: { result: OutcomeResult; reason?: OutcomeReason; notes?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [result, setResult] = useState<OutcomeResult>(current?.result ?? "won");
  const [reason, setReason] = useState<OutcomeReason | "">((current?.reason as OutcomeReason) ?? "");
  const [notes, setNotes] = useState(current?.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Only a loss has a "why did we lose" — a win asks a different question, and
  // withdrawing is its own answer.
  const reasons: OutcomeReason[] =
    result === "lost" ? LOSS_REASONS : result === "won" ? ["price_too_low", "other"] : ["no_bid_submitted", "timing", "other"];

  async function submit() {
    setSaving(true);
    try {
      await onSave({
        result,
        reason: reason === "" ? undefined : reason,
        notes: notes.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Record outcome"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              <Trophy className="h-4 w-4 text-amber-500" />
              How did this bid end?
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              This feeds your win rate and next bid&apos;s suggestions.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="btn-ghost h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {(["won", "lost", "withdrawn"] as OutcomeResult[]).map((r) => (
            <button
              key={r}
              onClick={() => {
                setResult(r);
                setReason("");
              }}
              aria-pressed={result === r}
              className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                result === r
                  ? r === "won"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : r === "lost"
                      ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                      : "border-slate-400 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {result === "lost" ? "Why did we lose it?" : result === "won" ? "Anything notable?" : "Why no bid?"}
          </span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as OutcomeReason | "")}
            className="input mt-1 text-sm"
          >
            <option value="">Not sure / prefer not to say</option>
            {reasons.map((r) => (
              <option key={r} value={r}>
                {OUTCOME_REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Notes (optional)</span>
          <textarea
            value={notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. came in 8% over the winning number"
            className="input mt-1 resize-y text-sm"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button onClick={() => void submit()} disabled={saving} className="btn-primary px-4 py-1.5 text-sm">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save outcome
          </button>
        </div>
      </div>
    </div>
  );
}
