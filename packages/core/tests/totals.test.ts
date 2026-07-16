import { describe, it, expect } from "vitest";
import type { BidLineItem } from "@bidwright/shared";
import {
  isIntegerCents,
  assertIntegerCents,
  sumCents,
  applyPercent,
  lineItemTotalCents,
} from "@bidwright/shared";
import { computeBidTotals, recalculateBid } from "../src/generation/totals";

function li(partial: Partial<BidLineItem>): BidLineItem {
  return {
    id: "x",
    description: "item",
    quantity: 1,
    unit: "EA",
    unitCostCents: 0,
    totalCostCents: 0,
    notes: null,
    sourcePage: null,
    confidence: null,
    ...partial,
  };
}

describe("integer cents invariant", () => {
  it("accepts safe integers", () => {
    expect(isIntegerCents(0)).toBe(true);
    expect(isIntegerCents(1250)).toBe(true);
    expect(isIntegerCents(-500)).toBe(true);
  });

  it("rejects floats, NaN, and non-numbers", () => {
    expect(isIntegerCents(12.5)).toBe(false);
    expect(isIntegerCents(NaN)).toBe(false);
    expect(isIntegerCents(Infinity)).toBe(false);
    expect(isIntegerCents("1250")).toBe(false);
    expect(isIntegerCents(null)).toBe(false);
  });

  it("assertIntegerCents throws on a float", () => {
    expect(() => assertIntegerCents(1.5, "unitCost")).toThrow(/unitCost must be an integer/);
  });

  it("assertIntegerCents passes an integer through", () => {
    expect(() => assertIntegerCents(100)).not.toThrow();
  });
});

describe("money helpers", () => {
  it("sumCents adds without float drift", () => {
    expect(sumCents([1, 2, 3])).toBe(6);
    expect(sumCents([])).toBe(0);
    // classic float trap: 0.1 + 0.2 — in cents this is exact
    expect(sumCents([10, 20])).toBe(30);
  });

  it("applyPercent rounds to whole cents", () => {
    expect(applyPercent(1000, 10)).toBe(100);
    expect(applyPercent(1005, 10)).toBe(101); // 100.5 -> 101
    expect(applyPercent(0, 10)).toBe(0);
    expect(isIntegerCents(applyPercent(3333, 7.5))).toBe(true);
  });

  it("lineItemTotalCents handles fractional quantities but yields integer cents", () => {
    expect(lineItemTotalCents(2, 500)).toBe(1000);
    expect(lineItemTotalCents(2.5, 501)).toBe(1253); // 1252.5 -> 1253
    expect(isIntegerCents(lineItemTotalCents(3.33, 777))).toBe(true);
  });
});

describe("computeBidTotals", () => {
  it("sums line items into the subtotal", () => {
    const totals = computeBidTotals(
      [li({ totalCostCents: 1000 }), li({ totalCostCents: 2500 })],
      0,
      0,
    );
    expect(totals.subtotalCents).toBe(3500);
    expect(totals.totalCents).toBe(3500);
  });

  it("applies overhead and profit each as a percent of subtotal", () => {
    const totals = computeBidTotals([li({ totalCostCents: 10000 })], 10, 5);
    expect(totals.subtotalCents).toBe(10000);
    expect(totals.overheadCents).toBe(1000);
    expect(totals.profitCents).toBe(500);
    expect(totals.totalCents).toBe(11500);
  });

  it("is all-zero for an unpriced draft", () => {
    const totals = computeBidTotals([li({}), li({})], 10, 10);
    expect(totals.subtotalCents).toBe(0);
    expect(totals.totalCents).toBe(0);
  });

  it("keeps every output an integer number of cents", () => {
    const totals = computeBidTotals([li({ totalCostCents: 3333 })], 7.5, 3.25);
    for (const v of Object.values(totals)) expect(isIntegerCents(v)).toBe(true);
  });

  it("handles an empty line item list", () => {
    expect(computeBidTotals([], 10, 10).totalCents).toBe(0);
  });
});

describe("recalculateBid", () => {
  const baseBid = {
    id: "b1",
    itbFileName: "itb.pdf",
    status: "draft" as const,
    createdAt: "2026-07-16T00:00:00Z",
    updatedAt: "2026-07-16T00:00:00Z",
    // extraction isn't touched by the math
    extraction: {} as never,
    lineItems: [
      li({ id: "1", quantity: 10, unitCostCents: 250, totalCostCents: 0 }),
      li({ id: "2", quantity: 3, unitCostCents: 1000, totalCostCents: 999999 }),
    ],
    assumptions: [],
    clarifications: [],
    exclusions: [],
    subtotalCents: 0,
    overheadPercent: 10,
    profitPercent: 10,
    totalCents: 0,
    validityDays: 30,
  };

  it("recomputes line totals from quantity x unit cost", () => {
    const out = recalculateBid(baseBid);
    expect(out.lineItems[0].totalCostCents).toBe(2500);
    // stale total is corrected, not trusted
    expect(out.lineItems[1].totalCostCents).toBe(3000);
  });

  it("rolls line totals up into subtotal and total", () => {
    const out = recalculateBid(baseBid);
    expect(out.subtotalCents).toBe(5500);
    expect(out.totalCents).toBe(5500 + 550 + 550);
  });

  it("does not mutate the input bid", () => {
    const before = baseBid.lineItems[1].totalCostCents;
    recalculateBid(baseBid);
    expect(baseBid.lineItems[1].totalCostCents).toBe(before);
  });
});
