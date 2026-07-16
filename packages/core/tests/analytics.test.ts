import { describe, it, expect } from "vitest";
import {
  decidedBids, winRateByGc, winRateByTrade, overallWinRate, averageBidToAwardDays,
  averageMarginPercent, lossReasons, winRateTrend, historyWithGc, summarize,
  type AnalyticsBid,
} from "../src/intelligence/analytics";

let n = 0;
function bid(p: Partial<AnalyticsBid> = {}): AnalyticsBid {
  n++;
  return {
    id: `b${n}`,
    gcName: "Turner Ridge",
    primaryTrade: "electrical",
    status: "submitted",
    subtotalCents: 100_000,
    totalCents: 118_000,
    createdAt: "2026-01-01T00:00:00Z",
    outcome: null,
    ...p,
  };
}

const won = (p: Partial<AnalyticsBid> = {}) =>
  bid({ status: "won", outcome: { result: "won", notedAt: "2026-02-01T00:00:00Z" }, ...p });
const lost = (p: Partial<AnalyticsBid> = {}) =>
  bid({ status: "lost", outcome: { result: "lost", reason: "price_too_high", notedAt: "2026-02-01T00:00:00Z" }, ...p });

describe("decidedBids", () => {
  it("counts only won and lost", () => {
    const bids = [
      won(), lost(),
      bid({ status: "draft" }),
      bid({ status: "submitted" }),
      bid({ status: "withdrawn", outcome: { result: "withdrawn", notedAt: "2026-02-01T00:00:00Z" } }),
    ];
    expect(decidedBids(bids)).toHaveLength(2);
  });
});

describe("overallWinRate", () => {
  it("is won / (won + lost)", () => {
    const r = overallWinRate([won(), won(), lost(), lost()]);
    expect(r.rate).toBe(0.5);
    expect(r.won).toBe(2);
    expect(r.lost).toBe(2);
  });

  it("excludes withdrawn bids — a no-bid isn't a loss", () => {
    // Punishing good no-bid discipline would be actively harmful advice.
    const withdrawn = bid({ status: "withdrawn", outcome: { result: "withdrawn", notedAt: "2026-02-01T00:00:00Z" } });
    expect(overallWinRate([won(), withdrawn]).rate).toBe(1);
  });

  it("ignores undecided bids", () => {
    expect(overallWinRate([won(), bid({ status: "draft" })]).rate).toBe(1);
  });

  it("is null rather than 0 when nothing is decided", () => {
    // 0% would read as "you lose everything"; the truth is "we don't know yet".
    expect(overallWinRate([bid(), bid()]).rate).toBeNull();
    expect(overallWinRate([]).rate).toBeNull();
  });

  it("sums the value of won bids in integer cents", () => {
    const r = overallWinRate([won({ totalCents: 500 }), won({ totalCents: 250 }), lost({ totalCents: 999 })]);
    expect(r.wonValueCents).toBe(750);
  });
});

describe("winRateByGc", () => {
  it("groups by GC", () => {
    const rows = winRateByGc([
      won({ gcName: "Turner Ridge" }),
      lost({ gcName: "Turner Ridge" }),
      won({ gcName: "Austin Commercial" }),
    ]);
    const turner = rows.find((r) => r.key === "Turner Ridge")!;
    expect(turner.rate).toBe(0.5);
    expect(rows.find((r) => r.key === "Austin Commercial")!.rate).toBe(1);
  });

  it("orders by how much evidence there is, not by rate", () => {
    // A 100% rate over one bid must not outrank 60% over ten.
    const rows = winRateByGc([
      won({ gcName: "OneOff" }),
      ...Array.from({ length: 6 }, () => won({ gcName: "Regular" })),
      ...Array.from({ length: 4 }, () => lost({ gcName: "Regular" })),
    ]);
    expect(rows[0].key).toBe("Regular");
  });

  it("labels missing GCs rather than dropping them", () => {
    const rows = winRateByGc([won({ gcName: null }), lost({ gcName: "  " })]);
    expect(rows[0].key).toBe("Unknown GC");
    expect(rows[0].won + rows[0].lost).toBe(2);
  });
});

describe("winRateByTrade", () => {
  it("groups by trade and defaults a missing trade to other", () => {
    const rows = winRateByTrade([won({ primaryTrade: "electrical" }), lost({ primaryTrade: null })]);
    expect(rows.map((r) => r.key).sort()).toEqual(["electrical", "other"]);
  });
});

describe("averageBidToAwardDays", () => {
  it("averages days from creation to outcome", () => {
    const days = averageBidToAwardDays([
      won({ createdAt: "2026-01-01T00:00:00Z", outcome: { result: "won", notedAt: "2026-01-11T00:00:00Z" } }),
      lost({ createdAt: "2026-01-01T00:00:00Z", outcome: { result: "lost", notedAt: "2026-01-21T00:00:00Z" } }),
    ]);
    expect(days).toBe(15);
  });

  it("is null with nothing decided", () => {
    expect(averageBidToAwardDays([bid()])).toBeNull();
  });

  it("ignores a negative span from a backdated outcome", () => {
    const bad = won({ createdAt: "2026-02-01T00:00:00Z", outcome: { result: "won", notedAt: "2026-01-01T00:00:00Z" } });
    expect(averageBidToAwardDays([bad])).toBeNull();
  });
});

describe("averageMarginPercent", () => {
  it("averages markup over cost", () => {
    // 118000 over 100000 = 18%.
    expect(averageMarginPercent([bid({ subtotalCents: 100_000, totalCents: 118_000 })])).toBeCloseTo(18);
  });

  it("ignores unpriced bids — a draft has no margin", () => {
    const m = averageMarginPercent([
      bid({ subtotalCents: 0, totalCents: 0 }),
      bid({ subtotalCents: 100_000, totalCents: 110_000 }),
    ]);
    expect(m).toBeCloseTo(10);
  });

  it("is null when nothing is priced", () => {
    expect(averageMarginPercent([bid({ subtotalCents: 0, totalCents: 0 })])).toBeNull();
  });
});

describe("lossReasons", () => {
  it("ranks reasons by frequency with a share", () => {
    const rows = lossReasons([
      lost({ outcome: { result: "lost", reason: "price_too_high", notedAt: "2026-02-01T00:00:00Z" } }),
      lost({ outcome: { result: "lost", reason: "price_too_high", notedAt: "2026-02-01T00:00:00Z" } }),
      lost({ outcome: { result: "lost", reason: "timing", notedAt: "2026-02-01T00:00:00Z" } }),
      won(),
    ]);
    expect(rows[0]).toMatchObject({ reason: "price_too_high", count: 2 });
    expect(rows[0].share).toBeCloseTo(2 / 3);
  });

  it("defaults a reasonless loss to other", () => {
    const rows = lossReasons([lost({ outcome: { result: "lost", notedAt: "2026-02-01T00:00:00Z" } })]);
    expect(rows[0].reason).toBe("other");
  });

  it("is empty with no losses", () => {
    expect(lossReasons([won()])).toEqual([]);
  });
});

describe("winRateTrend", () => {
  it("buckets by outcome month, in order", () => {
    const t = winRateTrend([
      won({ outcome: { result: "won", notedAt: "2026-01-15T00:00:00Z" } }),
      lost({ outcome: { result: "lost", notedAt: "2026-01-20T00:00:00Z" } }),
      won({ outcome: { result: "won", notedAt: "2026-03-02T00:00:00Z" } }),
    ]);
    expect(t.map((p) => p.month)).toEqual(["2026-01", "2026-03"]);
    expect(t[0].rate).toBe(0.5);
    expect(t[1].rate).toBe(1);
  });

  it("buckets by when it was decided, not when it was created", () => {
    const t = winRateTrend([
      won({ createdAt: "2026-01-01T00:00:00Z", outcome: { result: "won", notedAt: "2026-06-01T00:00:00Z" } }),
    ]);
    expect(t[0].month).toBe("2026-06");
  });

  it("is empty with nothing decided", () => {
    expect(winRateTrend([bid()])).toEqual([]);
  });
});

describe("historyWithGc", () => {
  it("summarizes the track record with one GC", () => {
    const h = historyWithGc(
      [won({ gcName: "Turner Ridge" }), lost({ gcName: "Turner Ridge" }), bid({ gcName: "Turner Ridge" }), won({ gcName: "Other" })],
      "Turner Ridge",
    );
    expect(h).toMatchObject({ total: 3, won: 1, lost: 1, pending: 1, rate: 0.5 });
  });

  it("matches case-insensitively — extracted GC names drift", () => {
    expect(historyWithGc([won({ gcName: "Turner Ridge" })], "turner ridge")?.won).toBe(1);
  });

  it("returns null for an unknown or missing GC", () => {
    expect(historyWithGc([won({ gcName: "Turner Ridge" })], "Nobody")).toBeNull();
    expect(historyWithGc([won()], null)).toBeNull();
  });
});

describe("summarize", () => {
  it("assembles the dashboard payload", () => {
    const s = summarize([won(), lost(), bid({ status: "draft" })]);
    expect(s.totalBids).toBe(3);
    expect(s.decided).toBe(2);
    expect(s.overall.rate).toBe(0.5);
    expect(s.byGc.length).toBeGreaterThan(0);
    expect(s.trend.length).toBeGreaterThan(0);
  });

  it("is safe on an empty account", () => {
    const s = summarize([]);
    expect(s).toMatchObject({ totalBids: 0, decided: 0 });
    expect(s.overall.rate).toBeNull();
    expect(s.byGc).toEqual([]);
    expect(s.averageBidToAwardDays).toBeNull();
  });
});
