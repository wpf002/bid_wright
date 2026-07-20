"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Search, Loader2, AlertCircle, RefreshCw, ArrowUp, ArrowDown, FileText, Clock } from "lucide-react";
import { formatCents, counterparty, counterpartyName } from "@bidwright/shared";
import { api, type BidRow } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { countdown, relativeTime, matchesQuery, sortBids, type SortKey, type SortDir } from "@/lib/bid-board";

/**
 * The full historical list. The bid board answers "what needs my attention
 * this week"; this answers "what have we bid, and how did it go".
 */

const STATUSES: Record<string, { label: string; class: string }> = {
  draft: { label: "Draft", class: "badge-slate" },
  in_review: { label: "In Review", class: "badge-amber" },
  submitted: { label: "Submitted", class: "badge-green" },
  won: { label: "Won", class: "badge-green" },
  lost: { label: "Lost", class: "badge-red" },
  withdrawn: { label: "Withdrawn", class: "badge-slate" },
};

const TONE: Record<string, string> = {
  overdue: "text-red-600 dark:text-red-400",
  urgent: "text-red-600 dark:text-red-400",
  soon: "text-amber-600 dark:text-amber-400",
  normal: "text-slate-500",
  none: "text-slate-400",
};

type Outcome = "all" | "won" | "lost" | "withdrawn" | "open";

export default function AllBidsPage() {
  const { user } = useRequireAuth();
  const [bids, setBids] = useState<BidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [trade, setTrade] = useState<string>("all");
  const [gc, setGc] = useState<string>("all");
  const [outcome, setOutcome] = useState<Outcome>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = useCallback(async () => {
    setError(null);
    try {
      setBids(await api.listBids());
    } catch {
      setError("Could not load bids");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  // Filter options come from the data, so they never offer an empty result.
  const trades = useMemo(
    () => [...new Set(bids.map((b) => b.primaryTrade).filter(Boolean))].sort() as string[],
    [bids],
  );
  // Whoever the bid goes to, GC or agency. Filtering on gcName alone left every
  // public solicitation out of the dropdown and unreachable from this filter.
  const counterparties = useMemo(
    () => [...new Set(bids.map((b) => counterparty(b)?.name).filter(Boolean))].sort() as string[],
    [bids],
  );

  const visible = useMemo(() => {
    const filtered = bids
      .filter((b) => matchesQuery(b, query))
      .filter((b) => status === "all" || b.status === status)
      .filter((b) => trade === "all" || b.primaryTrade === trade)
      .filter((b) => gc === "all" || counterparty(b)?.name === gc)
      .filter((b) => {
        if (outcome === "all") return true;
        if (outcome === "open") return !b.outcome;
        return b.outcome?.result === outcome;
      });
    return sortBids(filtered, sortKey, sortDir);
  }, [bids, query, status, trade, gc, outcome, sortKey, sortDir]);

  const totalValue = useMemo(() => visible.reduce((sum, b) => sum + b.totalCents, 0), [visible]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">All Bids</h1>
        <p className="mt-1 text-sm text-slate-500">
          {visible.length} of {bids.length} {bids.length === 1 ? "Bid" : "Bids"}
          {totalValue > 0 && ` · ${formatCents(totalValue)} Shown`}
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </span>
          <button onClick={() => void load()} className="btn-secondary px-2.5 py-1 text-xs">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {bids.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <p className="text-sm text-slate-500">No bids yet.</p>
          <Link href="/bids/new" className="btn-primary mt-4 px-4 py-2 text-sm">
            Upload your first ITB
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Search project, GC, trade…"
                aria-label="Search bids"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <Select
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                ["all", "All statuses"],
                ...Object.entries(STATUSES).map(([k, v]) => [k, v.label] as [string, string]),
              ]}
            />
            <Select
              label="Trade"
              value={trade}
              onChange={setTrade}
              options={[["all", "All trades"], ...trades.map((t) => [t, t.replace(/_/g, " ")] as [string, string])]}
            />
            <Select
              label="GC / Owner"
              value={gc}
              onChange={setGc}
              options={[
                ["all", "All"],
                ...counterparties.map((c) => [c, c] as [string, string]),
              ]}
            />
            <Select
              label="Outcome"
              value={outcome}
              onChange={(v) => setOutcome(v as Outcome)}
              options={[
                ["all", "Any outcome"],
                ["open", "No outcome yet"],
                ["won", "Won"],
                ["lost", "Lost"],
                ["withdrawn", "Withdrawn"],
              ]}
            />
          </div>

          <ul className="space-y-2 sm:hidden">
            {visible.map((b) => {
              const st = STATUSES[b.status] ?? STATUSES.draft;
              return (
                <li key={b.id} className="card p-3">
                  <Link href={`/bids/${b.id}`} className="block">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {b.projectName ?? b.itbFileName}
                      </span>
                      <span className={`${st.class} shrink-0`}>{st.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{counterpartyName(b)}</p>
                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">{formatCents(b.totalCents)}</span>
                      <span className="text-slate-400">{relativeTime(b.updatedAt)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="card hidden overflow-hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
                  <tr>
                    <Th onClick={() => toggleSort("project")} active={sortKey === "project"} dir={sortDir}>Project</Th>
                    <Th onClick={() => toggleSort("gc")} active={sortKey === "gc"} dir={sortDir}>GC / Owner</Th>
                    <th className="px-4 py-3 font-medium">Trade</th>
                    <Th onClick={() => toggleSort("deadline")} active={sortKey === "deadline"} dir={sortDir}>Deadline</Th>
                    <Th onClick={() => toggleSort("status")} active={sortKey === "status"} dir={sortDir}>Status</Th>
                    <th className="px-4 py-3 text-right font-medium">Value</th>
                    <Th onClick={() => toggleSort("updatedAt")} active={sortKey === "updatedAt"} dir={sortDir}>Updated</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visible.map((b) => {
                    const cd = countdown(b.bidDeadline);
                    const st = STATUSES[b.status] ?? STATUSES.draft;
                    return (
                      <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          {/* One line, capped: long names ellipsize with the full
                              text on hover rather than widening the table. */}
                          <Link
                            href={`/bids/${b.id}`}
                            title={b.projectName ?? b.itbFileName}
                            className="block max-w-[18rem] truncate font-medium text-slate-900 hover:text-amber-600 dark:text-slate-100"
                          >
                            {b.projectName ?? b.itbFileName}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                            <FileText className="h-3 w-3 shrink-0" />
                            <span className="truncate">{b.itbFileName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          <div className="max-w-[15rem] truncate" title={counterpartyName(b)}>
                            {counterpartyName(b)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="badge-slate capitalize">
                            {(b.primaryTrade ?? "other").replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1.5 whitespace-nowrap text-xs ${TONE[cd.tone]}`}>
                            <Clock className="h-3 w-3 shrink-0" />
                            {cd.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={st.class}>{st.label}</span>
                          {/* Why it was lost matters more than that it was lost. */}
                          {b.outcome?.reason && (
                            <div className="mt-0.5 text-[11px] capitalize text-slate-400">
                              {b.outcome.reason.replace(/_/g, " ")}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatCents(b.totalCents)}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{relativeTime(b.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {visible.length === 0 && (
            <div className="card px-4 py-12 text-center text-sm text-slate-500">
              No bids match these filters.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input w-auto py-1.5 text-xs capitalize"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function Th({
  children, onClick, active, dir,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: SortDir;
}) {
  return (
    <th className="px-4 py-3 font-medium">
      <button
        onClick={onClick}
        className="flex items-center gap-1 uppercase tracking-wide hover:text-slate-900 dark:hover:text-slate-200"
        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      >
        {children}
        {active && (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}
