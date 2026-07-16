"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, AlertTriangle, Loader2, Plus, Trash2, Check, CloudOff, FileText, Sparkles, Trophy, History,
} from "lucide-react";
import { formatCents, type BidLineItem, type ExtractionResult } from "@bidwright/shared";
import { api, ApiError, type BidRow, type CostSuggestionsResponse, type GcHistory } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useAutosave } from "@/lib/use-autosave";
import { PdfViewer } from "@/components/PdfViewer";
import { ClauseList } from "@/components/ClauseList";
import { ExportMenu } from "@/components/ExportMenu";
import { CostSuggestionBadge } from "@/components/CostSuggestionBadge";
import { ClauseLibrary } from "@/components/ClauseLibrary";
import { OutcomeDialog } from "@/components/OutcomeDialog";
import {
  parseDollarsToCents, formatCentsForInput, parseQuantity, withRecalculatedTotal,
  computeTotals, unpricedCount, blankLineItem, confidenceTone, type EditableBid,
} from "@/lib/editor";

const OUTCOME_LABEL: Record<string, string> = { won: "Won", lost: "Lost", withdrawn: "Withdrawn" };

const TABS = ["Overview", "Line Items", "Assumptions", "Clarifications", "Exclusions", "Compliance"] as const;
type Tab = (typeof TABS)[number];

export default function BidEditorPage() {
  const params = useParams<{ id: string }>();
  const bidId = params.id;
  const { user } = useRequireAuth();

  const [bid, setBid] = useState<BidRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [page, setPage] = useState(1);
  const [jumpNonce, setJumpNonce] = useState(0);
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<EditableBid | null>(null);
  const [costs, setCosts] = useState<CostSuggestionsResponse | null>(null);
  const [gcHistory, setGcHistory] = useState<GcHistory | null>(null);
  const [outcomeOpen, setOutcomeOpen] = useState(false);

  const hydrate = useCallback((row: BidRow) => {
    setBid(row);
    setDraft({
      lineItems: row.lineItems ?? [],
      assumptions: row.assumptions ?? [],
      clarifications: row.clarifications ?? [],
      exclusions: row.exclusions ?? [],
      overheadPercent: row.overheadPercent,
      profitPercent: row.profitPercent,
      validityDays: row.validityDays,
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await api.getBid(bidId);
        if (!cancelled) hydrate(row);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiError && err.status === 404
              ? "Bid not found."
              : "Could not load this bid.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bidId, user, hydrate]);

  // Cost suggestions from the user's own finalized bids. Loaded alongside the
  // bid; a failure here must never block editing.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .costSuggestions(bidId)
      .then((c) => !cancelled && setCosts(c))
      .catch(() => undefined);
    api
      .gcHistory(bidId)
      .then((h) => !cancelled && setGcHistory(h))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [bidId, user]);

  /**
   * Null-safe functional updater for the draft. Children always run behind the
   * `!draft` guard, so they can treat it as non-null; the functional form keeps
   * batched edits from overwriting each other.
   */
  const updateDraft = useCallback<React.Dispatch<React.SetStateAction<EditableBid>>>((action) => {
    setDraft((prev) =>
      prev === null
        ? prev
        : typeof action === "function"
          ? (action as (p: EditableBid) => EditableBid)(prev)
          : action,
    );
  }, []);

  const totals = useMemo(
    () => (draft ? computeTotals(draft.lineItems, draft.overheadPercent, draft.profitPercent) : null),
    [draft],
  );

  const save = useCallback(
    async (value: EditableBid) => {
      const t = computeTotals(value.lineItems, value.overheadPercent, value.profitPercent);
      await api.updateBid(bidId, {
        lineItems: value.lineItems,
        assumptions: value.assumptions,
        clarifications: value.clarifications,
        exclusions: value.exclusions,
        overheadPercent: value.overheadPercent,
        profitPercent: value.profitPercent,
        validityDays: value.validityDays,
        subtotalCents: t.subtotalCents,
        totalCents: t.totalCents,
      });
    },
    [bidId],
  );

  const { state: saveState } = useAutosave(draft as EditableBid, { onSave: save, delayMs: 2000 });

  /** Click-through provenance: send the PDF to a scope item's source page. */
  const jumpToPage = useCallback((target: number | null) => {
    if (!target) return;
    setPage(target);
    setJumpNonce((n) => n + 1);
  }, []);

  async function runDraft() {
    setDrafting(true);
    try {
      hydrate(await api.generateBid(bidId));
      toast.success("Bid response drafted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not draft the response");
    } finally {
      setDrafting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (loadError || !bid || !draft || !totals) {
    return (
      <div className="mx-auto max-w-md px-8 py-20 text-center">
        <p className="text-sm text-slate-500">{loadError ?? "Could not load this bid."}</p>
        <Link href="/dashboard" className="btn-secondary mt-4 px-4 py-2 text-sm">
          Back to Bid Board
        </Link>
      </div>
    );
  }

  const extraction = bid.extraction as ExtractionResult;
  const warnings = extraction?.warnings ?? [];
  const notDrafted = draft.lineItems.length === 0;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
        <div className="min-w-0">
          <Link
            href="/dashboard"
            className="mb-0.5 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" />
            Bid Board
          </Link>
          <h1 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
            {bid.projectName ?? bid.itbFileName}
          </h1>
          <p className="truncate text-xs text-slate-500">
            {bid.gcName ?? "Unknown GC"} · {bid.itbFileName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <SaveIndicator state={saveState} />
          <button onClick={() => setOutcomeOpen(true)} className="btn-secondary px-2.5 py-1.5 text-xs">
            <Trophy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{bid.outcome ? OUTCOME_LABEL[bid.outcome.result] : "Outcome"}</span>
          </button>
          <ExportMenu bid={{ ...bid, ...draft }} companyName={user?.companyName ?? "Your Company"} />
          <div className="text-right">
            <div className="font-mono text-lg font-semibold text-slate-900 dark:text-slate-100">
              {formatCents(totals.totalCents)}
            </div>
            <div className="text-xs text-slate-500">Total bid</div>
          </div>
        </div>
      </header>

      {outcomeOpen && (
        <OutcomeDialog
          current={bid.outcome}
          onClose={() => setOutcomeOpen(false)}
          onSave={async (outcome) => {
            const updated = await api.updateBid(bidId, { outcome } as Partial<BidRow>);
            setBid(updated);
            toast.success(`Marked ${outcome.result}`);
          }}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <div className="hidden w-1/2 border-r border-slate-200 lg:block dark:border-slate-800">
          <PdfViewer bidId={bidId} page={page} onPageChange={setPage} jumpNonce={jumpNonce} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {warnings.length > 0 && (
            <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                {warnings.length} thing{warnings.length === 1 ? "" : "s"} to check before you bid
              </div>
              <ul className="mt-1.5 space-y-1 pl-6 text-xs text-amber-700 dark:text-amber-400">
                {warnings.map((w, i) => (
                  <li key={i} className="list-disc">{w}</li>
                ))}
              </ul>
            </div>
          )}

          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 px-3 dark:border-slate-800">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-current={tab === t}
                className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  tab === t
                    ? "border-amber-500 text-slate-900 dark:text-slate-100"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                {t}
                {t === "Line Items" && draft.lineItems.length > 0 && (
                  <span className="ml-1.5 font-mono text-xs text-slate-400">{draft.lineItems.length}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-auto p-5">
            {notDrafted && tab !== "Overview" && tab !== "Compliance" ? (
              <NotDrafted onDraft={() => void runDraft()} drafting={drafting} />
            ) : (
              <>
                {tab === "Overview" && (
                  <OverviewTab
                    extraction={extraction}
                    draft={draft}
                    totals={totals}
                    onJump={jumpToPage}
                    onChange={updateDraft}
                    notDrafted={notDrafted}
                    onDraft={() => void runDraft()}
                    drafting={drafting}
                    gcHistory={gcHistory}
                  />
                )}
                {tab === "Line Items" && (
                  <LineItemsTab draft={draft} onChange={updateDraft} onJump={jumpToPage} totals={totals} costs={costs} />
                )}
                {tab === "Assumptions" && (
                  <>
                    <ClauseLibrary
                      kind="assumption"
                      trade={bid.primaryTrade}
                      current={draft.assumptions}
                      onInsert={(text) =>
                        updateDraft((prev) =>
                          prev.assumptions.includes(text)
                            ? prev
                            : { ...prev, assumptions: [...prev.assumptions, text] },
                        )
                      }
                    />
                    <ClauseList
                      items={draft.assumptions}
                      onChange={(assumptions) => updateDraft((prev) => ({ ...prev, assumptions }))}
                      addLabel="Add an assumption…"
                      emptyHint="No assumptions yet. These protect you on site conditions, schedule, and GC coordination."
                    />
                  </>
                )}
                {tab === "Clarifications" && (
                  <>
                    <ClauseLibrary
                      kind="clarification"
                      trade={bid.primaryTrade}
                      current={draft.clarifications}
                      onInsert={(text) =>
                        updateDraft((prev) =>
                          prev.clarifications.includes(text)
                            ? prev
                            : { ...prev, clarifications: [...prev.clarifications, text] },
                        )
                      }
                    />
                    <ClauseList
                      items={draft.clarifications}
                      onChange={(clarifications) => updateDraft((prev) => ({ ...prev, clarifications }))}
                      addLabel="Add a clarification…"
                      emptyHint="No clarifications yet. These are the questions to ask the GC before submitting."
                    />
                  </>
                )}
                {tab === "Exclusions" && (
                  <>
                    <ClauseLibrary
                      kind="exclusion"
                      trade={bid.primaryTrade}
                      current={draft.exclusions}
                      onInsert={(text) =>
                        updateDraft((prev) =>
                          prev.exclusions.includes(text)
                            ? prev
                            : { ...prev, exclusions: [...prev.exclusions, text] },
                        )
                      }
                    />
                    <ClauseList
                      items={draft.exclusions}
                      onChange={(exclusions) => updateDraft((prev) => ({ ...prev, exclusions }))}
                      addLabel="Add an exclusion…"
                      emptyHint="No exclusions yet. These carve out work you are not doing."
                    />
                  </>
                )}
                {tab === "Compliance" && <ComplianceTab extraction={extraction} />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: string }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600">
        <Check className="h-3 w-3" /> Saved
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-600">
        <CloudOff className="h-3 w-3" /> Not saved
      </span>
    );
  }
  if (state === "dirty") return <span className="text-xs text-slate-400">Unsaved changes</span>;
  return null;
}

function NotDrafted({ onDraft, drafting }: { onDraft: () => void; drafting: boolean }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Sparkles className="h-8 w-8 text-amber-500" />
      <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
        Response not drafted yet
      </h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        The ITB has been read and the scope extracted. Draft the response to get line items,
        assumptions, clarifications, and exclusions.
      </p>
      <button onClick={onDraft} disabled={drafting} className="btn-primary mt-5 px-4 py-2 text-sm">
        {drafting && <Loader2 className="h-4 w-4 animate-spin" />}
        {drafting ? "Drafting…" : "Draft response"}
      </button>
    </div>
  );
}

function Confidence({ value }: { value: number | null }) {
  const tone = confidenceTone(value);
  if (tone === "none") return null;
  const cls = tone === "high" ? "badge-green" : tone === "medium" ? "badge-amber" : "badge-red";
  return <span className={cls}>{Math.round((value ?? 0) * 100)}%</span>;
}

function OverviewTab({
  extraction, draft, totals, onJump, onChange, notDrafted, onDraft, drafting, gcHistory,
}: {
  extraction: ExtractionResult;
  draft: EditableBid;
  totals: ReturnType<typeof computeTotals>;
  onJump: (p: number | null) => void;
  onChange: React.Dispatch<React.SetStateAction<EditableBid>>;
  notDrafted: boolean;
  onDraft: () => void;
  drafting: boolean;
  gcHistory: GcHistory | null;
}) {
  const m = extraction?.metadata;
  const unpriced = unpricedCount(draft.lineItems);

  return (
    <div className="space-y-6">
      {gcHistory && (
        <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900/60">
          <History className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span className="text-slate-700 dark:text-slate-300">
            You&apos;ve bid <span className="font-medium">{gcHistory.gcName}</span> {gcHistory.total}{" "}
            {gcHistory.total === 1 ? "time" : "times"} before
            {gcHistory.won + gcHistory.lost > 0 ? (
              <>
                {" "}— won {gcHistory.won}, lost {gcHistory.lost}
                {gcHistory.rate !== null && ` (${Math.round(gcHistory.rate * 100)}%)`}
              </>
            ) : (
              " — none decided yet"
            )}
            {gcHistory.pending > 0 && `, ${gcHistory.pending} still open`}.
          </span>
        </div>
      )}

      {notDrafted && (
        <div className="card flex items-center justify-between gap-3 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Scope extracted. Draft the response to get line items and clauses.
          </div>
          <button onClick={onDraft} disabled={drafting} className="btn-primary shrink-0 px-3 py-1.5 text-xs">
            {drafting && <Loader2 className="h-3 w-3 animate-spin" />}
            {drafting ? "Drafting…" : "Draft response"}
          </button>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Project</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field label="Project" value={m?.projectName} />
          <Field label="Address" value={m?.projectAddress} />
          <Field label="General Contractor" value={m?.generalContractor} />
          <Field label="Owner" value={m?.owner} />
          <Field label="Bid deadline" value={m?.bidDeadline} />
          <Field label="RFI deadline" value={m?.rfiDeadline} />
          <Field label="Walkthrough" value={m?.walkthroughDate} />
          <Field
            label="Contact"
            value={[m?.contactName, m?.contactEmail, m?.contactPhone].filter(Boolean).join(" · ") || null}
          />
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Extracted scope <span className="font-normal text-slate-400">· click to see the source</span>
        </h2>
        <ul className="space-y-1.5">
          {(extraction?.scope ?? []).map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onJump(s.sourcePage)}
                disabled={!s.sourcePage}
                className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-50 disabled:cursor-default dark:hover:bg-slate-800/50"
              >
                <Confidence value={s.confidence} />
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                  {s.description}
                  {s.quantity !== null && (
                    <span className="ml-1.5 font-mono text-xs text-slate-400">
                      {s.quantity} {s.unit}
                    </span>
                  )}
                </span>
                {s.sourcePage && (
                  <span className="flex shrink-0 items-center gap-1 font-mono text-xs text-slate-400 group-hover:text-amber-600">
                    <FileText className="h-3 w-3" />p.{s.sourcePage}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {!notDrafted && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Pricing</h2>
          {unpriced > 0 && (
            <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
              {unpriced} of {draft.lineItems.length} line items still need a unit price.
            </p>
          )}
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            <Row label="Subtotal" value={formatCents(totals.subtotalCents)} />
            <PercentRow
              label="Overhead"
              percent={draft.overheadPercent}
              cents={totals.overheadCents}
              onChange={(overheadPercent) => onChange((prev) => ({ ...prev, overheadPercent }))}
            />
            <PercentRow
              label="Profit"
              percent={draft.profitPercent}
              cents={totals.profitCents}
              onChange={(profitPercent) => onChange((prev) => ({ ...prev, profitPercent }))}
            />
            <Row label="Total" value={formatCents(totals.totalCents)} strong />
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            Quote valid for
            <input
              type="number"
              min={1}
              value={draft.validityDays}
              onChange={(e) => { const v = Math.max(1, Number(e.target.value) || 1); onChange((prev) => ({ ...prev, validityDays: v })); }}
              className="input w-20 py-1 text-center font-mono"
            />
            days
          </label>
        </section>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className={`text-sm ${strong ? "font-semibold text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"}`}>
        {label}
      </span>
      <span className={`font-mono text-sm ${strong ? "font-semibold text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}>
        {value}
      </span>
    </div>
  );
}

function PercentRow({
  label, percent, cents, onChange,
}: {
  label: string;
  percent: number;
  cents: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={percent}
          onChange={(e) => onChange(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
          className="input w-16 py-0.5 text-center font-mono text-xs"
          aria-label={`${label} percent`}
        />
        <span className="text-xs text-slate-400">%</span>
      </div>
      <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{formatCents(cents)}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900 dark:text-slate-100">
        {value ?? <span className="text-slate-400">Not found</span>}
      </dd>
    </div>
  );
}

function LineItemsTab({
  draft, onChange, onJump, totals, costs,
}: {
  draft: EditableBid;
  onChange: React.Dispatch<React.SetStateAction<EditableBid>>;
  onJump: (p: number | null) => void;
  totals: ReturnType<typeof computeTotals>;
  costs: CostSuggestionsResponse | null;
}) {
  // Functional update: two fields blurred in the same tick would otherwise each
  // build from the same stale `draft` closure, and the second would drop the first.
  function update(index: number, patch: Partial<BidLineItem>) {
    onChange((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li, i) =>
        i === index ? withRecalculatedTotal({ ...li, ...patch }) : li,
      ),
    }));
  }

  const matched = draft.lineItems.filter((li) => costs?.suggestions[li.id]).length;
  const unpricedWithSuggestion = draft.lineItems.filter(
    (li) => li.unitCostCents === 0 && costs?.suggestions[li.id],
  ).length;

  /** Apply every suggestion to items the estimator hasn't priced yet. */
  function applyAllSuggestions() {
    onChange((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li) => {
        const s = costs?.suggestions[li.id];
        // Never overwrite a price the estimator already entered.
        if (!s || li.unitCostCents !== 0) return li;
        return withRecalculatedTotal({ ...li, unitCostCents: s.avgUnitCostCents });
      }),
    }));
  }

  return (
    <div>
      {matched > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          <span>
            Priced {matched} of {draft.lineItems.length} line items from your history
            {costs && ` · ${costs.historySize} past line items in ${costs.trade.replace(/_/g, " ")}`}
          </span>
          {unpricedWithSuggestion > 0 && (
            <button onClick={applyAllSuggestions} className="btn-secondary px-2 py-1 text-xs">
              Use all {unpricedWithSuggestion}
            </button>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {/* min-width keeps the description column readable in the split view;
              without it the fixed columns crush it to a few characters. */}
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
              <tr>
                <th className="min-w-[240px] px-3 py-2 font-medium">Description</th>
                <th className="w-24 px-3 py-2 text-right font-medium">Qty</th>
                <th className="w-20 px-3 py-2 font-medium">Unit</th>
                <th className="w-40 px-3 py-2 text-right font-medium">Unit cost</th>
                <th className="w-32 px-3 py-2 text-right font-medium">Total</th>
                <th className="w-16 px-3 py-2 font-medium">Src</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {draft.lineItems.map((li, i) => (
                <tr key={li.id} className="group">
                  <td className="min-w-[240px] px-3 py-1.5 align-top">
                    <input
                      value={li.description}
                      onChange={(e) => update(i, { description: e.target.value })}
                      className="w-full bg-transparent py-1 text-sm text-slate-900 outline-none dark:text-slate-100"
                      placeholder="Description"
                      aria-label="Description"
                    />
                    {/* The model flags anything needing the estimator's input. */}
                    {li.notes && (
                      <p className="pb-1 text-xs leading-snug text-amber-600 dark:text-amber-400">{li.notes}</p>
                    )}
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    <input
                      defaultValue={String(li.quantity)}
                      onBlur={(e) => {
                        const q = parseQuantity(e.target.value);
                        if (q === null) e.target.value = String(li.quantity);
                        else update(i, { quantity: q });
                      }}
                      className="w-full bg-transparent py-1 text-right font-mono text-sm outline-none"
                      inputMode="decimal"
                      aria-label="Quantity"
                    />
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    <input
                      value={li.unit}
                      onChange={(e) => update(i, { unit: e.target.value })}
                      className="w-full bg-transparent py-1 font-mono text-sm outline-none"
                      aria-label="Unit"
                    />
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    <input
                      key={`${li.id}-${li.unitCostCents}`}
                      defaultValue={formatCentsForInput(li.unitCostCents)}
                      onBlur={(e) => {
                        const cents = parseDollarsToCents(e.target.value);
                        if (cents === null) {
                          e.target.value = formatCentsForInput(li.unitCostCents);
                        } else {
                          update(i, { unitCostCents: cents });
                          e.target.value = formatCentsForInput(cents);
                        }
                      }}
                      className={`w-full bg-transparent py-1 text-right font-mono text-sm outline-none ${
                        li.unitCostCents === 0 ? "text-amber-600 dark:text-amber-400" : ""
                      }`}
                      inputMode="decimal"
                      aria-label="Unit cost"
                    />
                    {costs?.suggestions[li.id] && (
                      <div className="flex justify-end">
                        <CostSuggestionBadge
                          suggestion={costs.suggestions[li.id]}
                          applied={li.unitCostCents === costs.suggestions[li.id].avgUnitCostCents}
                          onApply={(cents) => update(i, { unitCostCents: cents })}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right align-top font-mono text-sm text-slate-900 dark:text-slate-100">
                    {formatCents(li.totalCostCents)}
                  </td>
                  <td className="px-3 py-1.5">
                    {li.sourcePage ? (
                      <button
                        onClick={() => onJump(li.sourcePage)}
                        className="font-mono text-xs text-slate-400 hover:text-amber-600"
                      >
                        p.{li.sourcePage}
                      </button>
                    ) : (
                      <span className="font-mono text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <button
                      onClick={() =>
                        onChange((prev) => ({ ...prev, lineItems: prev.lineItems.filter((_, idx) => idx !== i) }))
                      }
                      aria-label="Delete line item"
                      className="rounded p-1 text-slate-300 opacity-0 hover:bg-slate-100 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right text-sm font-medium text-slate-600 dark:text-slate-400">
                  Subtotal
                </td>
                <td className="px-3 py-2 text-right font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {formatCents(totals.subtotalCents)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <button
        onClick={() =>
          onChange((prev) => ({ ...prev, lineItems: [...prev.lineItems, blankLineItem(crypto.randomUUID())] }))
        }
        className="btn-secondary mt-3 px-3 py-1.5 text-xs"
      >
        <Plus className="h-3.5 w-3.5" />
        Add line item
      </button>
    </div>
  );
}

function ComplianceTab({ extraction }: { extraction: ExtractionResult }) {
  const c = extraction?.compliance;
  if (!c) return <p className="text-sm text-slate-500">No compliance data extracted.</p>;

  const flags: { label: string; on: boolean; detail?: string | null }[] = [
    { label: "Bid bond required", on: c.bondRequired, detail: c.bondPercent ? `${c.bondPercent}%` : null },
    { label: "Insurance required", on: c.insuranceRequired },
    { label: "Prevailing wage", on: c.prevailingWage },
    { label: "Davis-Bacon", on: c.davisBacon },
    { label: "Union required", on: c.unionRequired },
    { label: "Prequalification required", on: c.prequalRequired },
  ];

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Requirements</h2>
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {flags.map((f) => (
            <div key={f.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-slate-700 dark:text-slate-300">{f.label}</span>
              <span className={f.on ? "badge-amber" : "badge-slate"}>
                {f.on ? (f.detail ? `Yes · ${f.detail}` : "Yes") : "No"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <ListSection title="Insurance limits" items={c.insuranceLimits} />
      <ListSection title="Licensing" items={c.licenseRequirements} />
      <ListSection title="Other requirements" items={c.otherRequirements} />
    </div>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <ul className="space-y-1 pl-4 text-sm text-slate-600 dark:text-slate-400">
        {items.map((i, idx) => (
          <li key={idx} className="list-disc marker:text-slate-300">{i}</li>
        ))}
      </ul>
    </section>
  );
}
