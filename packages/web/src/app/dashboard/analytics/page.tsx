"use client";

import { useState, useEffect } from "react";
import { Loader2, TrendingUp, Clock, Percent, Trophy } from "lucide-react";
import { formatCents } from "@bidwright/shared";
import { api, type AnalyticsSummary, type WinRate } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";

/**
 * Win/loss analytics.
 *
 * Every rate excludes withdrawn and undecided bids. Sample size sits next to
 * each number, because a lone "100%" over one bid is worse than no number at
 * all — it invites a decision the data can't support.
 */
export default function AnalyticsPage() {
  const { user } = useRequireAuth();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api
      .analytics()
      .then(setData)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-8">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Analytics</h1>
        <p className="mt-4 text-sm text-slate-500">Could not load analytics.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Analytics</h1>
      <p className="mt-1 text-sm text-slate-500">
        {data.decided} of {data.totalBids} {data.totalBids === 1 ? "bid" : "bids"} decided
        {data.decided < data.totalBids && " · withdrawn and open bids are excluded from win rates"}
      </p>

      {data.decided === 0 ? (
        <div className="card mt-8 px-6 py-16 text-center">
          <Trophy className="mx-auto h-8 w-8 text-slate-300" />
          <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
            No outcomes recorded yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Mark a bid Won or Lost — with the reason — and this fills in. Win rate by GC is usually
            the first thing worth knowing.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              icon={Trophy}
              label="Win rate"
              value={data.overall.rate === null ? "—" : `${Math.round(data.overall.rate * 100)}%`}
              sub={`${data.overall.won}W · ${data.overall.lost}L`}
            />
            <Stat
              icon={TrendingUp}
              label="Won value"
              value={formatCents(data.overall.wonValueCents)}
              sub={`${data.overall.won} ${data.overall.won === 1 ? "job" : "jobs"}`}
            />
            <Stat
              icon={Clock}
              label="Bid to award"
              value={data.averageBidToAwardDays === null ? "—" : `${data.averageBidToAwardDays.toFixed(0)}d`}
              sub="average"
            />
            <Stat
              icon={Percent}
              label="Avg margin"
              value={data.averageMarginPercent === null ? "—" : `${data.averageMarginPercent.toFixed(1)}%`}
              sub="overhead + profit"
            />
          </div>

          {data.trend.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Win rate over time</h2>
              <div className="card mt-3 p-4">
                {/* Bars are fixed-width: with one or two months, flex-1 stretches
                    a single bar across the whole card and reads as a full bar
                    rather than one data point. */}
                <div className="flex items-end justify-start gap-3 overflow-x-auto">
                  {data.trend.map((p) => {
                    const pct = p.rate === null ? 0 : Math.round(p.rate * 100);
                    return (
                      <div key={p.month} className="flex w-14 shrink-0 flex-col items-center gap-1">
                        <span className="font-mono text-[10px] text-slate-400">{pct}%</span>
                        <div className="flex h-24 w-full items-end rounded bg-slate-100 dark:bg-slate-800">
                          <div
                            className="w-full rounded bg-amber-500 transition-all"
                            style={{ height: `${Math.max(pct, 2)}%` }}
                            title={`${p.won} won, ${p.lost} lost`}
                          />
                        </div>
                        <span className="whitespace-nowrap font-mono text-[10px] text-slate-400">
                          {p.month.slice(2)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {p.won + p.lost} {p.won + p.lost === 1 ? "bid" : "bids"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <RateTable title="Win rate by GC" rows={data.byGc} emptyHint="No decided bids yet." />
            <RateTable title="Win rate by trade" rows={data.byTrade} emptyHint="No decided bids yet." />
          </div>

          {data.lossReasons.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Why we lose</h2>
              <div className="card mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {data.lossReasons.map((r) => (
                  <div key={r.reason} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-44 shrink-0 text-sm capitalize text-slate-700 dark:text-slate-300">
                      {r.reason.replace(/_/g, " ")}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-red-400" style={{ width: `${r.share * 100}%` }} />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-xs text-slate-500">
                      {r.count} · {Math.round(r.share * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  icon: Icon, label, value, sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="text-xs text-slate-400">{sub}</div>
    </div>
  );
}

function RateTable({ title, rows, emptyHint }: { title: string; rows: WinRate[]; emptyHint: string }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {rows.length === 0 ? (
        <div className="card mt-3 px-4 py-8 text-center text-xs text-slate-500">{emptyHint}</div>
      ) : (
        <div className="card mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r) => {
            const pct = r.rate === null ? 0 : Math.round(r.rate * 100);
            const decided = r.won + r.lost;
            return (
              <div key={r.key} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className="w-32 shrink-0 truncate text-sm capitalize text-slate-700 dark:text-slate-300"
                  title={r.key}
                >
                  {r.key.replace(/_/g, " ")}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${pct >= 50 ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {/* Sample size next to the rate: 100% over one bid isn't a signal. */}
                <span className="w-24 shrink-0 text-right font-mono text-xs text-slate-500">
                  {pct}% · {decided}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
