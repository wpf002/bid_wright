"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { api, type BidRow } from "@/lib/api";
import { counterpartyName } from "@bidwright/shared";
import { useRequireAuth } from "@/lib/auth-context";
import { buildMonthGrid, chunkWeeks, monthLabel, addMonths, WEEKDAYS } from "@/lib/calendar";
import { countdown } from "@/lib/bid-board";

const TONE_DOT: Record<string, string> = {
  overdue: "bg-red-500",
  urgent: "bg-red-500",
  soon: "bg-amber-500",
  normal: "bg-slate-400",
  none: "bg-slate-300",
};

const TONE_TEXT: Record<string, string> = {
  overdue: "text-red-600 dark:text-red-400",
  urgent: "text-red-600 dark:text-red-400",
  soon: "text-amber-600 dark:text-amber-400",
  normal: "text-slate-500",
  none: "text-slate-400",
};

export default function CalendarPage() {
  const { user } = useRequireAuth();
  const [bids, setBids] = useState<BidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
  }));

  useEffect(() => {
    if (!user) return;
    api
      .listBids()
      .then(setBids)
      .catch(() => setError("Could not load bids"))
      .finally(() => setLoading(false));
  }, [user]);

  const weeks = useMemo(
    () => chunkWeeks(buildMonthGrid(cursor.year, cursor.month, bids, today)),
    [cursor, bids, today],
  );

  // The grid cells are too narrow to read a bid name on a phone, so this backs
  // it with a plain list of the month's deadlines, in date order.
  const monthDeadlines = useMemo(
    () =>
      weeks
        .flat()
        .filter((d) => d.inMonth)
        .flatMap((d) => d.bids.map((bid) => ({ date: d.date, bid }))),
    [weeks],
  );

  const withDeadline = bids.filter((b) => b.bidDeadline).length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Calendar</h1>
          <p className="mt-1 text-sm text-slate-500">
            {withDeadline} {withDeadline === 1 ? "bid" : "bids"} with a deadline
            {bids.length - withDeadline > 0 && ` · ${bids.length - withDeadline} without`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor((c) => addMonths(c.year, c.month, -1))}
            aria-label="Previous month"
            className="btn-secondary h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[9rem] text-center text-sm font-medium text-slate-900 dark:text-slate-100">
            {monthLabel(cursor.year, cursor.month)}
          </div>
          <button
            onClick={() => setCursor((c) => addMonths(c.year, c.month, 1))}
            aria-label="Next month"
            className="btn-secondary h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor({ year: today.getUTCFullYear(), month: today.getUTCMonth() })}
            className="btn-secondary ml-2 px-3 py-1.5 text-xs"
          >
            Today
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {weeks.flat().map((day) => (
            <div
              key={day.date.toISOString()}
              className={`min-h-[5.5rem] border-b border-r border-slate-100 p-1.5 last:border-r-0 dark:border-slate-800 ${
                day.inMonth ? "" : "bg-slate-50/60 dark:bg-slate-950/40"
              }`}
            >
              <div
                className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] ${
                  day.isToday
                    ? "bg-amber-500 font-semibold text-slate-950"
                    : day.inMonth
                      ? "text-slate-500"
                      : "text-slate-300 dark:text-slate-700"
                }`}
              >
                {day.date.getUTCDate()}
              </div>

              <div className="space-y-1">
                {day.bids.map((bid) => {
                  const tone = countdown(bid.bidDeadline, today).tone;
                  return (
                    <Link
                      key={bid.id}
                      href={`/bids/${bid.id}`}
                      title={`${bid.projectName ?? bid.itbFileName} — ${counterpartyName(bid)}`}
                      className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] leading-tight hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
                      <span className="truncate text-slate-700 dark:text-slate-300">
                        {bid.projectName ?? bid.itbFileName}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Readable list of the same deadlines — the grid text is unreadable on a
          phone or tablet, where each cell is barely a finger wide. */}
      <div className="mt-6 lg:hidden">
        <h2 className="mb-2 text-sm font-medium text-slate-500">
          {monthLabel(cursor.year, cursor.month)} deadlines
        </h2>
        {monthDeadlines.length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-slate-400">
            No deadlines this month.
          </p>
        ) : (
          <ul className="space-y-2">
            {monthDeadlines.map(({ date, bid }) => {
              const cd = countdown(bid.bidDeadline, today);
              return (
                <li key={bid.id}>
                  <Link href={`/bids/${bid.id}`} className="card flex items-center gap-3 p-3">
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800">
                      <span className="text-[10px] uppercase text-slate-500">
                        {date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })}
                      </span>
                      <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {date.getUTCDate()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {bid.projectName ?? bid.itbFileName}
                      </div>
                      <div className="truncate text-xs text-slate-500">{counterpartyName(bid)}</div>
                    </div>
                    <span className={`shrink-0 whitespace-nowrap text-xs font-medium ${TONE_TEXT[cd.tone]}`}>
                      {cd.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
