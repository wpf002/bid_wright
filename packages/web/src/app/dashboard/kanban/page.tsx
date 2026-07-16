"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Clock, GripVertical } from "lucide-react";
import type { BidStatus } from "@bidwright/shared";
import { api, type BidRow } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { countdown } from "@/lib/bid-board";

/** Withdrawn is deliberately absent: it's an outcome, not a pipeline stage. */
const COLUMNS: { status: BidStatus; label: string }[] = [
  { status: "draft", label: "Draft" },
  { status: "in_review", label: "In Review" },
  { status: "submitted", label: "Submitted" },
  { status: "won", label: "Won" },
  { status: "lost", label: "Lost" },
];

const TONE_TEXT: Record<string, string> = {
  overdue: "text-red-600 dark:text-red-400",
  urgent: "text-red-600 dark:text-red-400",
  soon: "text-amber-600 dark:text-amber-400",
  normal: "text-slate-500",
  none: "text-slate-400",
};

export default function KanbanPage() {
  const { user } = useRequireAuth();
  const [bids, setBids] = useState<BidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<BidStatus | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .listBids()
      .then(setBids)
      .catch(() => toast.error("Could not load bids"))
      .finally(() => setLoading(false));
  }, [user]);

  const grouped = useMemo(() => {
    const map = new Map<BidStatus, BidRow[]>();
    for (const col of COLUMNS) map.set(col.status, []);
    for (const bid of bids) {
      // A withdrawn bid has no column; keep it out rather than inventing one.
      map.get(bid.status)?.push(bid);
    }
    return map;
  }, [bids]);

  async function move(bidId: string, status: BidStatus) {
    const bid = bids.find((b) => b.id === bidId);
    if (!bid || bid.status === status) return;

    const previous = bid.status;
    // Optimistic: the card moves now, and rolls back if the write fails.
    setBids((prev) => prev.map((b) => (b.id === bidId ? { ...b, status } : b)));
    try {
      await api.updateBid(bidId, { status });
    } catch {
      setBids((prev) => prev.map((b) => (b.id === bidId ? { ...b, status: previous } : b)));
      toast.error("Could not update status");
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
    <div className="mx-auto max-w-[100rem] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Kanban</h1>
        <p className="mt-1 text-sm text-slate-500">Drag a bid to change its status.</p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const items = grouped.get(col.status) ?? [];
          return (
            <div
              key={col.status}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.status);
              }}
              onDragLeave={() => setOverCol((c) => (c === col.status ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setOverCol(null);
                if (dragId) void move(dragId, col.status);
                setDragId(null);
              }}
              className={`flex w-72 shrink-0 flex-col rounded-xl border p-2 transition-colors ${
                overCol === col.status
                  ? "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20"
                  : "border-slate-200 bg-slate-100/60 dark:border-slate-800 dark:bg-slate-900/40"
              }`}
            >
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{col.label}</span>
                <span className="font-mono text-xs text-slate-400">{items.length}</span>
              </div>

              <div className="flex-1 space-y-2">
                {items.map((bid) => {
                  const cd = countdown(bid.bidDeadline);
                  return (
                    <div
                      key={bid.id}
                      draggable
                      onDragStart={() => setDragId(bid.id)}
                      onDragEnd={() => setDragId(null)}
                      className={`card group cursor-grab p-3 active:cursor-grabbing ${
                        dragId === bid.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-slate-400" />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/bids/${bid.id}`}
                            className="block truncate text-sm font-medium text-slate-900 hover:text-amber-600 dark:text-slate-100"
                          >
                            {bid.projectName ?? bid.itbFileName}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{bid.gcName ?? "Unknown GC"}</p>
                          <div className={`mt-1.5 flex items-center gap-1 text-xs ${TONE_TEXT[cd.tone]}`}>
                            <Clock className="h-3 w-3" />
                            {cd.label}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {items.length === 0 && (
                  <div className="px-2 py-6 text-center text-xs text-slate-400">Nothing here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
