import type { BidRow } from "./api";

/**
 * Pure helpers behind the bid board. Kept free of React so the date/sort logic
 * that estimators depend on can be unit-tested directly.
 */

export type SortKey = "deadline" | "project" | "gc" | "status" | "updatedAt";
export type SortDir = "asc" | "desc";

export interface Countdown {
  /** Whole days until the deadline; negative once past. */
  days: number;
  label: string;
  tone: "overdue" | "urgent" | "soon" | "normal" | "none";
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Days between two instants, counted in whole calendar days (UTC-normalized). */
export function daysUntil(deadline: string | null, now: Date = new Date()): number | null {
  if (!deadline) return null;
  const due = new Date(deadline);
  if (Number.isNaN(due.getTime())) return null;
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((dueDay - nowDay) / MS_PER_DAY);
}

/** A deadline rendered the way an estimator reads it: how much time is left. */
export function countdown(deadline: string | null, now: Date = new Date()): Countdown {
  const days = daysUntil(deadline, now);
  if (days === null) return { days: 0, label: "No deadline", tone: "none" };
  if (days < 0) {
    const n = Math.abs(days);
    return { days, label: `${n} ${n === 1 ? "day" : "days"} overdue`, tone: "overdue" };
  }
  if (days === 0) return { days, label: "Due today", tone: "urgent" };
  if (days === 1) return { days, label: "Due tomorrow", tone: "urgent" };
  if (days <= 7) return { days, label: `${days} days left`, tone: "soon" };
  return { days, label: `${days} days left`, tone: "normal" };
}

/** "2 hours ago" style stamp for the last-touched column. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.round((now.getTime() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function matchesQuery(bid: BidRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [bid.projectName, bid.gcName, bid.ownerName, bid.primaryTrade, bid.itbFileName]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(q));
}

function sortValue(bid: BidRow, key: SortKey): string | number {
  switch (key) {
    case "deadline": {
      const t = bid.bidDeadline ? new Date(bid.bidDeadline).getTime() : NaN;
      // Bids with no deadline sort last regardless of direction.
      return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
    }
    case "project":
      return (bid.projectName ?? bid.itbFileName ?? "").toLowerCase();
    case "gc":
      return (bid.gcName ?? "").toLowerCase();
    case "status":
      return bid.status;
    case "updatedAt":
      return new Date(bid.updatedAt).getTime();
  }
}

export function sortBids(bids: BidRow[], key: SortKey, dir: SortDir): BidRow[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...bids].sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);
    // Missing deadlines stay at the bottom in both directions.
    if (key === "deadline") {
      const aMissing = av === Number.POSITIVE_INFINITY;
      const bMissing = bv === Number.POSITIVE_INFINITY;
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
    }
    if (av < bv) return -1 * factor;
    if (av > bv) return 1 * factor;
    return 0;
  });
}

/** Bids due within the next 7 days (and not already past). */
export function dueThisWeek(bids: BidRow[], now: Date = new Date()): BidRow[] {
  return bids.filter((b) => {
    const d = daysUntil(b.bidDeadline, now);
    return d !== null && d >= 0 && d <= 7;
  });
}
