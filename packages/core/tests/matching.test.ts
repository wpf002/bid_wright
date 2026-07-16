import { describe, it, expect } from "vitest";
import { isIntegerCents } from "@bidwright/shared";
import {
  normalizeUnit, normalizeDescription, tokenize, similarity, suggestCost,
  suggestCostsForItems, toCostRecord, SIMILARITY_THRESHOLD, type CostRecord,
} from "../src/intelligence/matching";

function rec(p: Partial<CostRecord> & { description: string; unitCostCents: number }): CostRecord {
  return {
    normalizedKey: normalizeDescription(p.description),
    trade: "electrical",
    unit: "LF",
    createdAt: "2026-01-01T00:00:00Z",
    ...p,
  };
}

describe("normalizeUnit", () => {
  it("canonicalizes common aliases", () => {
    expect(normalizeUnit("lf")).toBe("LF");
    expect(normalizeUnit("L.F.")).toBe("LF");
    expect(normalizeUnit("each")).toBe("EA");
    expect(normalizeUnit("lump sum")).toBe("LS");
    expect(normalizeUnit(" SqFt ")).toBe("SF");
  });
  it("passes unknown units through upper-cased", () => {
    expect(normalizeUnit("widgets")).toBe("WIDGETS");
  });
});

describe("tokenize / normalizeDescription", () => {
  it("drops punctuation, stopwords, and bare numbers", () => {
    // 3,500 is a quantity — it must not become part of the item's identity.
    expect(tokenize("Install approximately 3500 LF of EMT conduit for branch circuits"))
      .toEqual(["lf", "emt", "conduit", "branch", "circuits"]);
  });

  it("is order-insensitive", () => {
    expect(normalizeDescription("EMT conduit install"))
      .toBe(normalizeDescription("install conduit EMT"));
  });

  it("makes the same work with different quantities share a key", () => {
    expect(normalizeDescription("Install approximately 3,500 LF of EMT conduit"))
      .toBe(normalizeDescription("Install 4,200 LF of EMT conduit"));
  });

  it("returns empty for a description with no signal", () => {
    expect(normalizeDescription("the and of 500")).toBe("");
  });
});

describe("similarity", () => {
  it("is 1 for the same tokens", () => {
    expect(similarity("EMT conduit", "conduit EMT")).toBe(1);
  });
  it("is 0 for disjoint work", () => {
    expect(similarity("EMT conduit", "roof membrane")).toBe(0);
  });
  it("is between 0 and 1 for partial overlap", () => {
    const s = similarity("Install EMT conduit branch circuits", "Install EMT conduit");
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
  it("is 0 when either side has no tokens", () => {
    expect(similarity("", "conduit")).toBe(0);
  });
});

describe("suggestCost", () => {
  it("returns null with no history", () => {
    expect(suggestCost({ description: "EMT conduit", unit: "LF" }, [])).toBeNull();
  });

  it("matches an identical description and averages the history", () => {
    const s = suggestCost({ description: "Install EMT conduit for branch circuits", unit: "LF" }, [
      rec({ description: "Install EMT conduit for branch circuits", unitCostCents: 300 }),
      rec({ description: "Install EMT conduit for branch circuits", unitCostCents: 400 }),
    ]);
    expect(s).not.toBeNull();
    expect(s!.avgUnitCostCents).toBe(350);
    expect(s!.sampleSize).toBe(2);
    expect(s!.confidence).toBe(1);
  });

  it("matches across differing quantities in the text", () => {
    const s = suggestCost({ description: "Install approximately 4,200 LF of EMT conduit", unit: "LF" }, [
      rec({ description: "Install approximately 3,500 LF of EMT conduit", unitCostCents: 375 }),
    ]);
    expect(s?.avgUnitCostCents).toBe(375);
    expect(s?.confidence).toBe(1);
  });

  it("reports the most recent cost as lastUnitCostCents", () => {
    const s = suggestCost({ description: "EMT conduit", unit: "LF" }, [
      rec({ description: "EMT conduit", unitCostCents: 300, createdAt: "2026-01-01T00:00:00Z" }),
      rec({ description: "EMT conduit", unitCostCents: 500, createdAt: "2026-06-01T00:00:00Z" }),
    ]);
    expect(s!.lastUnitCostCents).toBe(500);
    expect(s!.minUnitCostCents).toBe(300);
    expect(s!.maxUnitCostCents).toBe(500);
  });

  it("never matches across units — $/LF is not $/EA", () => {
    const s = suggestCost({ description: "EMT conduit", unit: "EA" }, [
      rec({ description: "EMT conduit", unit: "LF", unitCostCents: 375 }),
    ]);
    expect(s).toBeNull();
  });

  it("treats unit aliases as the same unit", () => {
    const s = suggestCost({ description: "EMT conduit", unit: "l.f." }, [
      rec({ description: "EMT conduit", unit: "LF", unitCostCents: 375 }),
    ]);
    expect(s?.avgUnitCostCents).toBe(375);
  });

  it("does not match across trades when a trade is given", () => {
    const s = suggestCost({ description: "EMT conduit", unit: "LF", trade: "plumbing" }, [
      rec({ description: "EMT conduit", trade: "electrical", unitCostCents: 375 }),
    ]);
    expect(s).toBeNull();
  });

  it("falls back to a fuzzy match above the threshold", () => {
    const s = suggestCost({ description: "Install EMT conduit branch circuits", unit: "LF" }, [
      rec({ description: "Install EMT conduit for branch circuits classroom", unitCostCents: 375 }),
    ]);
    expect(s).not.toBeNull();
    expect(s!.confidence).toBeGreaterThanOrEqual(SIMILARITY_THRESHOLD);
    expect(s!.confidence).toBeLessThan(1);
  });

  it("refuses a weak match rather than suggesting a wrong price", () => {
    // Different work that shares one word must not inherit a price.
    const s = suggestCost({ description: "Install roof membrane", unit: "LF" }, [
      rec({ description: "Install EMT conduit for branch circuits", unitCostCents: 375 }),
    ]);
    expect(s).toBeNull();
  });

  it("prefers exact matches and ignores weaker fuzzy ones", () => {
    const s = suggestCost({ description: "EMT conduit", unit: "LF" }, [
      rec({ description: "EMT conduit", unitCostCents: 300 }),
      rec({ description: "EMT conduit fittings straps", unitCostCents: 9999 }),
    ]);
    expect(s!.confidence).toBe(1);
    expect(s!.sampleSize).toBe(1);
    expect(s!.avgUnitCostCents).toBe(300);
  });

  it("always yields integer cents", () => {
    // 3 samples that don't divide evenly.
    const s = suggestCost({ description: "EMT conduit", unit: "LF" }, [
      rec({ description: "EMT conduit", unitCostCents: 100 }),
      rec({ description: "EMT conduit", unitCostCents: 101 }),
      rec({ description: "EMT conduit", unitCostCents: 101 }),
    ]);
    expect(isIntegerCents(s!.avgUnitCostCents)).toBe(true);
    expect(s!.avgUnitCostCents).toBe(101);
  });

  it("returns null for a description with no usable tokens", () => {
    expect(suggestCost({ description: "the 500", unit: "LF" }, [rec({ description: "EMT conduit", unitCostCents: 1 })]))
      .toBeNull();
  });
});

describe("suggestCostsForItems", () => {
  const history = [
    rec({ description: "Install EMT conduit for branch circuits", unitCostCents: 375 }),
    rec({ description: "Pull copper branch wiring THHN", unitCostCents: 120 }),
  ];

  it("keys suggestions by line item id and omits non-matches", () => {
    const out = suggestCostsForItems(
      [
        { id: "1", description: "Install EMT conduit for branch circuits", unit: "LF" },
        { id: "2", description: "Pull copper branch wiring THHN", unit: "LF" },
        { id: "3", description: "Demolish roof membrane", unit: "LF" },
      ],
      history,
      "electrical",
    );
    expect(Object.keys(out).sort()).toEqual(["1", "2"]);
    expect(out["1"].avgUnitCostCents).toBe(375);
    expect(out["3"]).toBeUndefined();
  });

  it("returns nothing for an empty history", () => {
    expect(suggestCostsForItems([{ id: "1", description: "x y z", unit: "LF" }], [])).toEqual({});
  });
});

describe("toCostRecord", () => {
  it("stores the canonical key and unit alongside the original text", () => {
    const r = toCostRecord(
      { description: "Install approximately 3,500 LF of EMT conduit", unit: "l.f.", unitCostCents: 375 },
      "electrical",
    );
    expect(r.unit).toBe("LF");
    expect(r.description).toBe("Install approximately 3,500 LF of EMT conduit");
    expect(r.normalizedKey).toBe(normalizeDescription("Install 4,200 LF of EMT conduit"));
    expect(r.trade).toBe("electrical");
  });
});
