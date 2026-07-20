"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search, Clock, AlertCircle, FileText, Plus, Loader2, ArrowUp, ArrowDown, RefreshCw,
} from "lucide-react";
import { api, type BidRow } from "@/lib/api";
import { counterpartyName } from "@bidwright/shared";
import { useRequireAuth } from "@/lib/auth-context";
import {
  countdown, relativeTime, matchesQuery, sortBids, dueThisWeek,
  type SortKey, type SortDir,
} from "@/lib/bid-board";

const STATUSES: Record<string, { label: string; class: string }> = {
  draft: { label: "Draft", class: "badge-slate" },
  in_review: { label: "In Review", class: "badge-amber" },
  submitted: { label: "Submitted", class: "badge-green" },
  won: { label: "Won", class: "badge-green" },
  lost: { label: "Lost", class: "badge-red" },
  withdrawn: { label: "Withdrawn", class: "badge-slate" },
};

const TONE_CLASS: Record<string, string> = {
  overdue: "text-red-600 dark:text-red-400 font-medium",
  urgent: "text-red-600 dark:text-red-400 font-medium",
  soon: "text-amber-600 dark:text-amber-400",
  normal: "text-slate-600 dark:text-slate-400",
  none: "text-slate-400",
};

const STATUS_FILTERS = ["all", "draft", "in_review", "submitted", "won", "lost"] as const;

export default function BidBoardPage() {
  const { loading: authLoading, user } = useRequireAuth();
  const [bids, setBids] = useState<BidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("deadline");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const load = useCallback(async () => {
    setError(null);
    try {
      setBids(await api.listBids());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load bids");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const visible = useMemo(() => {
    const filtered = bids
      .filter((b) => matchesQuery(b, query))
      .filter((b) => status === "all" || b.status === status);
    return sortBids(filtered, sortKey, sortDir);
  }, [bids, query, status, sortKey, sortDir]);

  const weekCount = useMemo(() => dueThisWeek(bids).length, [bids]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // Wait for the auth check before rendering — avoids flashing an empty board
  // at a signed-in user while the session restores.
  if (authLoading || (loading && !error)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      {/* No "New Bid" button here — it lives in the sidebar, and two on one
          screen is just noise. */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Bid Board</h1>
        <p className="mt-1 text-sm text-slate-500">
          {bids.length} {bids.length === 1 ? "Bid" : "Bids"}
          {weekCount > 0 && ` · ${weekCount} Due This Week`}
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-6 flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </span>
          <button onClick={() => void load()} className="btn-secondary px-2.5 py-1 text-xs">
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {bids.length === 0 && !error ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Search project, GC, trade…"
                aria-label="Search bids"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  aria-pressed={status === s}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    status === s
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {s === "all" ? "All" : STATUSES[s]?.label ?? s}
                </button>
              ))}
            </div>
          </div>

          <ul className="space-y-2 sm:hidden">
            {visible.map((bid) => {
              const cd = countdown(bid.bidDeadline);
              const st = STATUSES[bid.status] ?? STATUSES.draft;
              return (
                <li key={bid.id} className="card p-3">
                  <Link href={`/bids/${bid.id}`} className="block">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {bid.projectName ?? bid.itbFileName}
                      </span>
                      <span className={`${st.class} shrink-0`}>{st.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{counterpartyName(bid)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`flex items-center gap-1.5 text-xs ${TONE_CLASS[cd.tone]}`}>
                        <Clock className="h-3.5 w-3.5" />
                        {cd.label}
                      </span>
                      <span className="badge-slate capitalize">
                        {(bid.primaryTrade ?? "other").replace(/_/g, " ")}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* A 6-column table is unreadable at 390px, so mobile gets cards. */}
          <div className="card hidden overflow-hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
                  <tr>
                    <Th onClick={() => toggleSort("project")} active={sortKey === "project"} dir={sortDir}>Project</Th>
                    <Th onClick={() => toggleSort("gc")} active={sortKey === "gc"} dir={sortDir}>GC / Owner</Th>
                    <th className="px-4 py-3 font-medium">Trade</th>
                    <Th onClick={() => toggleSort("deadline")} active={sortKey === "deadline"} dir={sortDir}>Deadline</Th>
                    <Th onClick={() => toggleSort("status")} active={sortKey === "status"} dir={sortDir}>Status</Th>
                    <Th onClick={() => toggleSort("updatedAt")} active={sortKey === "updatedAt"} dir={sortDir}>Last touched</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visible.map((bid) => {
                    const cd = countdown(bid.bidDeadline);
                    const st = STATUSES[bid.status] ?? STATUSES.draft;
                    return (
                      <tr key={bid.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          {/* One line, capped so a long project name ellipsizes
                              instead of widening the table. Full name on hover. */}
                          <Link
                            href={`/bids/${bid.id}`}
                            title={bid.projectName ?? bid.itbFileName}
                            className="block max-w-[18rem] truncate font-medium text-slate-900 hover:text-amber-600 dark:text-slate-100"
                          >
                            {bid.projectName ?? bid.itbFileName}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                            <FileText className="h-3 w-3 shrink-0" />
                            <span className="truncate">{bid.itbFileName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {/* One line, but capped: a 57-char federal agency name
                              would otherwise push the table past the viewport and
                              hide Status/Last touched behind a scroll. Full name on hover. */}
                          <div className="max-w-[15rem] truncate" title={counterpartyName(bid)}>
                            {counterpartyName(bid)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="badge-slate capitalize">
                            {(bid.primaryTrade ?? "other").replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`flex items-center gap-1.5 whitespace-nowrap ${TONE_CLASS[cd.tone]}`}>
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            {cd.label}
                          </div>
                          {bid.bidDeadline && (
                            <div className="mt-0.5 font-mono text-xs text-slate-400">
                              {new Date(bid.bidDeadline).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3"><span className={st.class}>{st.label}</span></td>
                        <td className="px-4 py-3 text-slate-500">{relativeTime(bid.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>

          {visible.length === 0 && (
            <div className="card px-4 py-12 text-center text-sm text-slate-500">
              No bids match {query ? `“${query}”` : "this filter"}.
            </div>
          )}
        </>
      )}
    </div>
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
        {active &&
          (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}

/** First-run state: the roadmap wants this to walk a new user to their first upload. */
function EmptyState() {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50">
        <FileText className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
        No bids yet
      </h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Drop in an ITB PDF and BidWright reads the scope, quantities, deadlines, and compliance
        requirements — then drafts a response you can edit. Takes about a minute.
      </p>
      <Link href="/bids/new" className="btn-primary mt-6 px-4 py-2 text-sm">
        <Plus className="h-4 w-4" />
        Upload Your First ITB
      </Link>
    </div>
  );
}
