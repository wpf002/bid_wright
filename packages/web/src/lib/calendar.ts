import type { BidRow } from "./api";

/**
 * Month-grid math for the calendar view. Pure and UTC-normalized so a bid due
 * on the 1st never renders on the previous day in a western timezone.
 */

export interface CalendarDay {
  date: Date;
  /** False for leading/trailing days borrowed from adjacent months. */
  inMonth: boolean;
  isToday: boolean;
  bids: BidRow[];
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** Monday-first weekday index (0 = Monday … 6 = Sunday). */
export function mondayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

/** Group bids by their deadline's UTC day. Bids without a deadline are omitted. */
export function bidsByDay(bids: BidRow[]): Map<string, BidRow[]> {
  const map = new Map<string, BidRow[]>();
  for (const bid of bids) {
    if (!bid.bidDeadline) continue;
    const d = new Date(bid.bidDeadline);
    if (Number.isNaN(d.getTime())) continue;
    const key = startOfUtcDay(d).toISOString().slice(0, 10);
    const list = map.get(key);
    if (list) list.push(bid);
    else map.set(key, [bid]);
  }
  return map;
}

/**
 * Build a Monday-first grid covering the month, padded with adjacent days so
 * every row has 7 cells.
 */
export function buildMonthGrid(
  year: number,
  month: number,
  bids: BidRow[],
  now: Date = new Date(),
): CalendarDay[] {
  const byDay = bidsByDay(bids);
  const first = new Date(Date.UTC(year, month, 1));
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - mondayIndex(first));

  const last = new Date(Date.UTC(year, month + 1, 0));
  const trailing = 6 - mondayIndex(last);
  const totalDays = mondayIndex(first) + last.getUTCDate() + trailing;

  const days: CalendarDay[] = [];
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + i);
    const key = date.toISOString().slice(0, 10);
    days.push({
      date,
      inMonth: date.getUTCMonth() === month,
      isToday: sameUtcDay(date, now),
      bids: byDay.get(key) ?? [],
    });
  }
  return days;
}

/** Split a flat grid into weeks of 7. */
export function chunkWeeks(days: CalendarDay[]): CalendarDay[][] {
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}
