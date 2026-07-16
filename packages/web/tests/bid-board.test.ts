import { describe, it, expect } from "vitest";
import type { BidRow } from "../src/lib/api";
import {
  daysUntil, countdown, relativeTime, matchesQuery, sortBids, dueThisWeek,
} from "../src/lib/bid-board";

const NOW = new Date("2026-07-16T12:00:00Z");

function bid(partial: Partial<BidRow>): BidRow {
  return {
    id: "b1",
    userId: "u1",
    itbFileName: "itb.pdf",
    projectName: "Project",
    gcName: "Turner Ridge",
    ownerName: "Dallas ISD",
    bidDeadline: null,
    primaryTrade: "electrical",
    status: "draft",
    extraction: {} as never,
    lineItems: [],
    assumptions: [],
    clarifications: [],
    exclusions: [],
    subtotalCents: 0,
    overheadPercent: 10,
    profitPercent: 10,
    totalCents: 0,
    validityDays: 30,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-16T10:00:00Z",
    ...partial,
  };
}

describe("daysUntil", () => {
  it("counts whole days ahead", () => {
    expect(daysUntil("2026-07-20T12:00:00Z", NOW)).toBe(4);
  });
  it("returns 0 on the deadline day regardless of time of day", () => {
    expect(daysUntil("2026-07-16T23:59:00Z", NOW)).toBe(0);
    expect(daysUntil("2026-07-16T00:01:00Z", NOW)).toBe(0);
  });
  it("goes negative once past", () => {
    expect(daysUntil("2026-07-14T12:00:00Z", NOW)).toBe(-2);
  });
  it("returns null for missing or unparseable dates", () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil("not a date", NOW)).toBeNull();
  });
});

describe("countdown", () => {
  it("labels an overdue bid", () => {
    const c = countdown("2026-07-14T12:00:00Z", NOW);
    expect(c.tone).toBe("overdue");
    expect(c.label).toBe("2 days overdue");
  });
  it("singularizes one day overdue", () => {
    expect(countdown("2026-07-15T12:00:00Z", NOW).label).toBe("1 day overdue");
  });
  it("labels today and tomorrow as urgent", () => {
    expect(countdown("2026-07-16T18:00:00Z", NOW)).toMatchObject({ tone: "urgent", label: "Due today" });
    expect(countdown("2026-07-17T09:00:00Z", NOW)).toMatchObject({ tone: "urgent", label: "Due tomorrow" });
  });
  it("flags the next week as soon", () => {
    expect(countdown("2026-07-22T12:00:00Z", NOW).tone).toBe("soon");
  });
  it("treats beyond a week as normal", () => {
    expect(countdown("2026-08-30T12:00:00Z", NOW).tone).toBe("normal");
  });
  it("handles a missing deadline", () => {
    expect(countdown(null, NOW)).toMatchObject({ tone: "none", label: "No deadline" });
  });
});

describe("relativeTime", () => {
  it("renders recent stamps", () => {
    expect(relativeTime("2026-07-16T11:58:00Z", NOW)).toBe("2m ago");
    expect(relativeTime("2026-07-16T09:00:00Z", NOW)).toBe("3h ago");
    expect(relativeTime("2026-07-14T12:00:00Z", NOW)).toBe("2d ago");
  });
  it("handles just-now and junk", () => {
    expect(relativeTime("2026-07-16T11:59:30Z", NOW)).toBe("just now");
    expect(relativeTime("garbage", NOW)).toBe("—");
  });
});

describe("matchesQuery", () => {
  const b = bid({ projectName: "Northside Elementary", gcName: "Turner Ridge", primaryTrade: "electrical" });

  it("matches project, GC, trade, and filename case-insensitively", () => {
    expect(matchesQuery(b, "northside")).toBe(true);
    expect(matchesQuery(b, "TURNER")).toBe(true);
    expect(matchesQuery(b, "electrical")).toBe(true);
    expect(matchesQuery(b, "itb.pdf")).toBe(true);
  });
  it("returns everything for an empty query", () => {
    expect(matchesQuery(b, "   ")).toBe(true);
  });
  it("rejects a non-match", () => {
    expect(matchesQuery(b, "plumbing")).toBe(false);
  });
  it("tolerates null fields", () => {
    expect(matchesQuery(bid({ projectName: null, gcName: null }), "x")).toBe(false);
  });
});

describe("sortBids", () => {
  const soon = bid({ id: "soon", bidDeadline: "2026-07-18T12:00:00Z" });
  const later = bid({ id: "later", bidDeadline: "2026-08-18T12:00:00Z" });
  const none = bid({ id: "none", bidDeadline: null });

  it("sorts by deadline ascending", () => {
    const out = sortBids([later, soon], "deadline", "asc");
    expect(out.map((b) => b.id)).toEqual(["soon", "later"]);
  });

  it("keeps bids with no deadline last in BOTH directions", () => {
    // A no-deadline bid shouldn't jump to the top just because you flipped sort.
    expect(sortBids([none, soon, later], "deadline", "asc").map((b) => b.id)).toEqual(["soon", "later", "none"]);
    expect(sortBids([none, soon, later], "deadline", "desc").map((b) => b.id)).toEqual(["later", "soon", "none"]);
  });

  it("sorts by project name", () => {
    const a = bid({ id: "a", projectName: "Alpha" });
    const z = bid({ id: "z", projectName: "Zulu" });
    expect(sortBids([z, a], "project", "asc").map((b) => b.id)).toEqual(["a", "z"]);
    expect(sortBids([a, z], "project", "desc").map((b) => b.id)).toEqual(["z", "a"]);
  });

  it("falls back to the filename when a project has no name", () => {
    const unnamed = bid({ id: "u", projectName: null, itbFileName: "aaa.pdf" });
    const named = bid({ id: "n", projectName: "Zulu" });
    expect(sortBids([named, unnamed], "project", "asc").map((b) => b.id)).toEqual(["u", "n"]);
  });

  it("does not mutate the input array", () => {
    const input = [later, soon];
    sortBids(input, "deadline", "asc");
    expect(input.map((b) => b.id)).toEqual(["later", "soon"]);
  });
});

describe("dueThisWeek", () => {
  it("counts only bids due in the next 7 days, excluding overdue", () => {
    const rows = [
      bid({ id: "overdue", bidDeadline: "2026-07-10T12:00:00Z" }),
      bid({ id: "today", bidDeadline: "2026-07-16T20:00:00Z" }),
      bid({ id: "in5", bidDeadline: "2026-07-21T12:00:00Z" }),
      bid({ id: "in30", bidDeadline: "2026-08-15T12:00:00Z" }),
      bid({ id: "none", bidDeadline: null }),
    ];
    expect(dueThisWeek(rows, NOW).map((b) => b.id)).toEqual(["today", "in5"]);
  });
});
