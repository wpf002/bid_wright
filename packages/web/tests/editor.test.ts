import { describe, it, expect } from "vitest";
import { isIntegerCents, type BidLineItem } from "@bidwright/shared";
import {
  parseDollarsToCents, formatCentsForInput, parseQuantity, withRecalculatedTotal,
  computeTotals, unpricedCount, reorder, blankLineItem, confidenceTone,
} from "../src/lib/editor";

function li(p: Partial<BidLineItem> = {}): BidLineItem {
  return {
    id: "1", description: "Item", quantity: 1, unit: "EA",
    unitCostCents: 0, totalCostCents: 0, notes: null, sourcePage: null, confidence: null,
    ...p,
  };
}

describe("parseDollarsToCents", () => {
  it("parses plain dollars", () => {
    expect(parseDollarsToCents("12.50")).toBe(1250);
    expect(parseDollarsToCents("0.01")).toBe(1);
    expect(parseDollarsToCents("100")).toBe(10000);
  });

  it("tolerates currency symbols and thousands separators", () => {
    expect(parseDollarsToCents("$1,250.00")).toBe(125000);
    expect(parseDollarsToCents(" $12.50 ")).toBe(1250);
  });

  it("treats blank as zero", () => {
    expect(parseDollarsToCents("")).toBe(0);
    expect(parseDollarsToCents("   ")).toBe(0);
  });

  it("rejects junk rather than silently zeroing a price", () => {
    expect(parseDollarsToCents("abc")).toBeNull();
    expect(parseDollarsToCents("12.5.3")).toBeNull();
    expect(parseDollarsToCents("1e5")).toBeNull();
  });

  it("always yields integer cents, even for float-hostile input", () => {
    // 0.1 + 0.2 style trouble never reaches the total.
    for (const input of ["0.1", "0.2", "12.345", "999.995", "1.005"]) {
      expect(isIntegerCents(parseDollarsToCents(input)!)).toBe(true);
    }
    expect(parseDollarsToCents("12.345")).toBe(1235); // rounds on the cent
  });

  it("round-trips through formatCentsForInput", () => {
    for (const cents of [0, 1, 1250, 123456]) {
      expect(parseDollarsToCents(formatCentsForInput(cents))).toBe(cents);
    }
  });
});

describe("parseQuantity", () => {
  it("parses integers and decimals", () => {
    expect(parseQuantity("240")).toBe(240);
    expect(parseQuantity("12.5")).toBe(12.5);
    expect(parseQuantity("3,500")).toBe(3500);
  });
  it("treats blank as zero and rejects junk or negatives", () => {
    expect(parseQuantity("")).toBe(0);
    expect(parseQuantity("abc")).toBeNull();
    expect(parseQuantity("-5")).toBeNull();
  });
});

describe("withRecalculatedTotal", () => {
  it("recomputes total from quantity x unit cost", () => {
    expect(withRecalculatedTotal(li({ quantity: 10, unitCostCents: 250 })).totalCostCents).toBe(2500);
  });
  it("keeps integer cents on fractional quantities", () => {
    const out = withRecalculatedTotal(li({ quantity: 2.5, unitCostCents: 501 }));
    expect(out.totalCostCents).toBe(1253);
    expect(isIntegerCents(out.totalCostCents)).toBe(true);
  });
  it("does not mutate the input", () => {
    const input = li({ quantity: 2, unitCostCents: 100 });
    withRecalculatedTotal(input);
    expect(input.totalCostCents).toBe(0);
  });
});

describe("computeTotals", () => {
  it("matches the API's math: overhead and profit each a percent of subtotal", () => {
    const totals = computeTotals([li({ totalCostCents: 10000 })], 10, 5);
    expect(totals).toEqual({
      subtotalCents: 10000, overheadCents: 1000, profitCents: 500, totalCents: 11500,
    });
  });
  it("is zero for an unpriced draft", () => {
    expect(computeTotals([li(), li()], 10, 10).totalCents).toBe(0);
  });
  it("keeps every field integer cents", () => {
    const totals = computeTotals([li({ totalCostCents: 3333 })], 7.5, 3.25);
    for (const v of Object.values(totals)) expect(isIntegerCents(v)).toBe(true);
  });
});

describe("unpricedCount", () => {
  it("counts line items still at zero", () => {
    expect(unpricedCount([li({ unitCostCents: 0 }), li({ unitCostCents: 500 }), li()])).toBe(2);
  });
});

describe("reorder", () => {
  it("moves an item and returns a new array", () => {
    const list = ["a", "b", "c"];
    expect(reorder(list, 0, 2)).toEqual(["b", "c", "a"]);
    expect(list).toEqual(["a", "b", "c"]);
  });
  it("is a no-op for same or out-of-range indices", () => {
    const list = ["a", "b"];
    expect(reorder(list, 1, 1)).toBe(list);
    expect(reorder(list, 0, 9)).toBe(list);
    expect(reorder(list, -1, 0)).toBe(list);
  });
});

describe("blankLineItem", () => {
  it("starts unpriced with no confidence — the estimator prices it", () => {
    const item = blankLineItem("x");
    expect(item.unitCostCents).toBe(0);
    expect(item.totalCostCents).toBe(0);
    expect(item.confidence).toBeNull();
    expect(item.unit).toBe("LS");
  });
});

describe("confidenceTone", () => {
  it("maps confidence onto badge tones", () => {
    expect(confidenceTone(0.95)).toBe("high");
    expect(confidenceTone(0.8)).toBe("high");
    expect(confidenceTone(0.7)).toBe("medium");
    expect(confidenceTone(0.5)).toBe("low");
    expect(confidenceTone(null)).toBe("none");
  });
});
