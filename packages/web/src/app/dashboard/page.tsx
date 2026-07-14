"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search, Filter, ChevronDown, Clock, AlertCircle,
  CheckCircle2, ArrowUpRight, FileText, Plus,
} from "lucide-react";

// Demo data — replaced by real API calls in Phase 3
const DEMO_BIDS = [
  {
    id: "1",
    project: "Downtown Office Fitout — Level 3",
    gc: "Turner Construction",
    trade: "electrical",
    deadline: "2026-07-28",
    status: "in_review" as const,
    assignedTo: "You",
    updatedAt: "2026-07-14T09:12:00Z",
    warnings: 2,
  },
  {
    id: "2",
    project: "Municipal Water Treatment — Phase 2",
    gc: "City of Dallas",
    trade: "plumbing",
    deadline: "2026-07-20",
    status: "draft" as const,
    assignedTo: "You",
    updatedAt: "2026-07-13T14:22:00Z",
    warnings: 0,
  },
  {
    id: "3",
    project: "Retail Center — HVAC Retrofit",
    gc: "Ryan Companies",
    trade: "hvac",
    deadline: "2026-08-05",
    status: "submitted" as const,
    assignedTo: "You",
    updatedAt: "2026-07-11T08:00:00Z",
    warnings: 0,
  },
];

const STATUSES = {
  draft: { label: "Draft", class: "badge-slate" },
  in_review: { label: "In Review", class: "badge-amber" },
  submitted: { label: "Submitted", class: "badge-green" },
  won: { label: "Won", class: "badge-green" },
  lost: { label: "Lost", class: "badge-red" },
  withdrawn: { label: "Withdrawn", class: "badge-slate" },
} as const;

export default function BidBoardPage() {
  const [query, setQuery] = useState("");
  const bids = DEMO_BIDS.filter((b) =>
    b.project.toLowerCase().includes(query.toLowerCase()) ||
    b.gc.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Bid Board</h1>
          <p className="mt-1 text-sm text-slate-500">
            {bids.length} active {bids.length === 1 ? "bid" : "bids"} · 2 due this week
          </p>
        </div>
        <Link href="/bids/new" className="btn-primary px-4 py-2 text-sm">
          <Plus className="h-4 w-4" />
          New bid
        </Link>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Active" value="3" hint="+1 this week" tone="default" />
        <StatCard label="Due in 7d" value="2" hint="Priority" tone="warning" />
        <StatCard label="Submitted (30d)" value="8" hint="Win rate 37%" tone="default" />
        <StatCard label="Time saved" value="14h" hint="This month" tone="success" />
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search project or GC..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="btn-secondary px-3 py-2 text-sm">
          <Filter className="h-4 w-4" />
          Filters
          <ChevronDown className="h-3 w-3" />
        </button>
        <button className="btn-secondary px-3 py-2 text-sm">
          Trade
          <ChevronDown className="h-3 w-3" />
        </button>
        <div className="ml-auto text-xs text-slate-400">Press <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] dark:border-slate-700 dark:bg-slate-800">⌘K</kbd> for commands</div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/50">
            <tr>
              <th className="px-6 py-3 font-medium">Project</th>
              <th className="px-6 py-3 font-medium">GC</th>
              <th className="px-6 py-3 font-medium">Trade</th>
              <th className="px-6 py-3 font-medium">Deadline</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Last touched</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {bids.map((b) => (
              <BidRow key={b.id} bid={b} />
            ))}
          </tbody>
        </table>

        {bids.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <FileText className="h-7 w-7" />
            </div>
            <h3 className="text-base font-medium text-slate-900 dark:text-slate-100">No bids match your search</h3>
            <p className="mt-1 text-sm text-slate-500">Try clearing your filters or upload a new ITB to get started.</p>
            <Link href="/bids/new" className="btn-primary mt-6 px-4 py-2 text-sm">
              <Plus className="h-4 w-4" />
              New bid
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label, value, hint, tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "default" | "warning" | "success";
}) {
  const toneClass = tone === "warning" ? "text-amber-600"
                  : tone === "success" ? "text-emerald-600"
                  : "text-slate-500";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      <div className={`mt-1 text-xs ${toneClass}`}>{hint}</div>
    </div>
  );
}

function BidRow({ bid }: { bid: typeof DEMO_BIDS[number] }) {
  const status = STATUSES[bid.status];
  const daysLeft = Math.ceil((new Date(bid.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const urgent = daysLeft <= 7 && daysLeft >= 0;

  return (
    <tr className="group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td className="px-6 py-4">
        <Link href={`/bids/${bid.id}`} className="block">
          <div className="font-medium text-slate-900 dark:text-slate-100">{bid.project}</div>
          {bid.warnings > 0 && (
            <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
              <AlertCircle className="h-3 w-3" />
              {bid.warnings} warning{bid.warnings === 1 ? "" : "s"}
            </div>
          )}
        </Link>
      </td>
      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{bid.gc}</td>
      <td className="px-6 py-4">
        <span className="badge-slate">{bid.trade}</span>
      </td>
      <td className="px-6 py-4">
        <div className={`flex items-center gap-1.5 text-sm ${urgent ? "text-amber-600 font-medium" : "text-slate-600 dark:text-slate-400"}`}>
          <Clock className="h-3.5 w-3.5" />
          {new Date(bid.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          <span className={urgent ? "text-amber-600" : "text-slate-400"}>({daysLeft}d)</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className={status.class}>{status.label}</span>
      </td>
      <td className="px-6 py-4 text-slate-500">
        {new Date(bid.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </td>
      <td className="px-6 py-4">
        <ArrowUpRight className="h-4 w-4 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />
      </td>
    </tr>
  );
}
