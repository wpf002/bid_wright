import { describe, it, expect } from "vitest";
import type { BidRow } from "../src/lib/api";
import {
  mondayIndex, monthLabel, addMonths, bidsByDay, buildMonthGrid, chunkWeeks,
} from "../src/lib/calendar";

function bid(id: string, deadline: string | null): BidRow {
  return {
    id, userId: "u1", itbFileName: "itb.pdf", projectName: `Project ${id}`,
    gcName: "GC", ownerName: "Owner", bidDeadline: deadline, primaryTrade: "electrical",
    status: "draft", extraction: {} as never, lineItems: [], assumptions: [],
    clarifications: [], exclusions: [], subtotalCents: 0, overheadPercent: 10,
    profitPercent: 10, totalCents: 0, validityDays: 30,
    createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z",
  };
}

// July 2026: the 1st is a Wednesday, the month has 31 days.
const JULY = { year: 2026, month: 6 };
const TODAY = new Date("2026-07-16T12:00:00Z");

describe("mondayIndex", () => {
  it("is 0 for Monday and 6 for Sunday", () => {
    expect(mondayIndex(new Date("2026-07-13T00:00:00Z"))).toBe(0); // Monday
    expect(mondayIndex(new Date("2026-07-19T00:00:00Z"))).toBe(6); // Sunday
  });
});

describe("monthLabel / addMonths", () => {
  it("labels the month", () => {
    expect(monthLabel(2026, 6)).toBe("July 2026");
  });
  it("rolls over a year boundary in both directions", () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe("bidsByDay", () => {
  it("groups bids by their deadline day", () => {
    const map = bidsByDay([
      bid("a", "2026-07-20T14:00:00Z"),
      bid("b", "2026-07-20T09:00:00Z"),
      bid("c", "2026-07-21T09:00:00Z"),
    ]);
    expect(map.get("2026-07-20")?.map((b) => b.id)).toEqual(["a", "b"]);
    expect(map.get("2026-07-21")?.map((b) => b.id)).toEqual(["c"]);
  });

  it("skips bids with no or unparseable deadline", () => {
    const map = bidsByDay([bid("a", null), bid("b", "not a date")]);
    expect(map.size).toBe(0);
  });
});

describe("buildMonthGrid", () => {
  const grid = buildMonthGrid(JULY.year, JULY.month, [], TODAY);

  it("produces whole weeks", () => {
    expect(grid.length % 7).toBe(0);
  });

  it("starts on a Monday and ends on a Sunday", () => {
    expect(mondayIndex(grid[0].date)).toBe(0);
    expect(mondayIndex(grid[grid.length - 1].date)).toBe(6);
  });

  it("covers every day of the month", () => {
    const inMonth = grid.filter((d) => d.inMonth);
    expect(inMonth).toHaveLength(31);
    expect(inMonth[0].date.getUTCDate()).toBe(1);
    expect(inMonth[30].date.getUTCDate()).toBe(31);
  });

  it("marks padding days from adjacent months", () => {
    // July 1 2026 is a Wednesday, so Mon 29 + Tue 30 June lead.
    expect(grid[0].inMonth).toBe(false);
    expect(grid[0].date.getUTCMonth()).toBe(5);
  });

  it("marks exactly one day as today", () => {
    expect(grid.filter((d) => d.isToday)).toHaveLength(1);
    expect(grid.find((d) => d.isToday)?.date.getUTCDate()).toBe(16);
  });

  it("places a bid on its deadline day, not the day before", () => {
    // A late-evening UTC deadline must not slip to the 19th.
    const g = buildMonthGrid(JULY.year, JULY.month, [bid("x", "2026-07-20T23:30:00Z")], TODAY);
    const day20 = g.find((d) => d.inMonth && d.date.getUTCDate() === 20);
    expect(day20?.bids.map((b) => b.id)).toEqual(["x"]);
  });

  it("leaves other days empty", () => {
    const g = buildMonthGrid(JULY.year, JULY.month, [bid("x", "2026-07-20T12:00:00Z")], TODAY);
    expect(g.filter((d) => d.bids.length > 0)).toHaveLength(1);
  });

  it("handles a month starting on Monday with no leading padding", () => {
    // June 2026 starts on a Monday.
    const g = buildMonthGrid(2026, 5, [], TODAY);
    expect(g[0].inMonth).toBe(true);
    expect(g[0].date.getUTCDate()).toBe(1);
  });
});

describe("chunkWeeks", () => {
  it("splits into rows of 7", () => {
    const weeks = chunkWeeks(buildMonthGrid(JULY.year, JULY.month, [], TODAY));
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});
