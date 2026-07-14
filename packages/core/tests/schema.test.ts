import { describe, it, expect } from "vitest";
import { validateExtraction, normalizeTrade, dominantTrade } from "../src/extraction/schema";
import { VALID_EXTRACTION_JSON } from "./fixtures/itb-sample";

describe("normalizeTrade", () => {
  it("passes through known slugs", () => {
    expect(normalizeTrade("electrical")).toBe("electrical");
    expect(normalizeTrade("fire_protection")).toBe("fire_protection");
  });

  it("normalizes spacing, casing, and hyphens", () => {
    expect(normalizeTrade("Fire Protection")).toBe("fire_protection");
    expect(normalizeTrade("LOW-VOLTAGE")).toBe("low_voltage");
    expect(normalizeTrade("  Electrical  ")).toBe("electrical");
  });

  it("falls back to 'other' for unknown or non-string input", () => {
    expect(normalizeTrade("underwater basket weaving")).toBe("other");
    expect(normalizeTrade(42)).toBe("other");
    expect(normalizeTrade(null)).toBe("other");
  });
});

describe("dominantTrade", () => {
  it("returns the most common non-other trade", () => {
    expect(dominantTrade(["electrical", "electrical", "plumbing", "other"])).toBe("electrical");
  });
  it("returns other when only other is present", () => {
    expect(dominantTrade(["other", "other"])).toBe("other");
    expect(dominantTrade([])).toBe("other");
  });
});

describe("validateExtraction", () => {
  it("accepts a well-formed extraction and round-trips it", () => {
    const data = JSON.parse(VALID_EXTRACTION_JSON);
    const res = validateExtraction(data, { pageCount: 3 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.metadata.projectName).toContain("Northside");
    expect(res.value.scope).toHaveLength(6);
    expect(res.value.primaryTrade).toBe("electrical");
    expect(res.value.compliance.bondRequired).toBe(true);
    expect(res.value.compliance.bondPercent).toBe(5);
  });

  it("clamps out-of-range confidence into [0,1]", () => {
    const res = validateExtraction({
      metadata: {},
      scope: [{ description: "x", trade: "electrical", confidence: 1.7, sourcePage: 1 }],
      inclusions: [],
      exclusions: [],
      compliance: {},
      primaryTrade: "electrical",
      warnings: [],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.scope[0].confidence).toBe(1);
  });

  it("coerces an unknown trade slug to 'other'", () => {
    const res = validateExtraction({
      metadata: {},
      scope: [{ description: "x", trade: "wizardry", confidence: 0.5, sourcePage: 1 }],
      inclusions: [], exclusions: [], compliance: {}, primaryTrade: "wizardry", warnings: [],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.scope[0].trade).toBe("other");
  });

  it("nulls a sourcePage beyond the real page count", () => {
    const res = validateExtraction({
      metadata: {},
      scope: [{ description: "x", trade: "electrical", confidence: 0.5, sourcePage: 99 }],
      inclusions: [], exclusions: [], compliance: {}, primaryTrade: "electrical", warnings: [],
    }, { pageCount: 3 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.scope[0].sourcePage).toBeNull();
  });

  it("backfills primaryTrade from scope when the model returns 'other'", () => {
    const res = validateExtraction({
      metadata: {},
      scope: [
        { description: "a", trade: "plumbing", confidence: 0.8, sourcePage: 1 },
        { description: "b", trade: "plumbing", confidence: 0.8, sourcePage: 1 },
      ],
      inclusions: [], exclusions: [], compliance: {}, primaryTrade: "other", warnings: [],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.primaryTrade).toBe("plumbing");
  });

  it("fills missing metadata fields with null", () => {
    const res = validateExtraction({
      metadata: { projectName: "Only Name" },
      scope: [], inclusions: [], exclusions: [], compliance: {}, primaryTrade: "other", warnings: [],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.metadata.projectName).toBe("Only Name");
    expect(res.value.metadata.contactEmail).toBeNull();
  });

  it("drops scope items missing a required description", () => {
    const res = validateExtraction({
      metadata: {},
      scope: [
        { description: "keeps", trade: "electrical", confidence: 0.9, sourcePage: 1 },
        { trade: "electrical", confidence: 0.9, sourcePage: 1 },
      ],
      inclusions: [], exclusions: [], compliance: {}, primaryTrade: "electrical", warnings: [],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.scope).toHaveLength(1);
    expect(res.value.scope[0].description).toBe("keeps");
  });

  it("rejects structurally broken input (scope not an array)", () => {
    const res = validateExtraction({
      metadata: {}, scope: "not an array", inclusions: [], exclusions: [],
      compliance: {}, primaryTrade: "electrical", warnings: [],
    });
    expect(res.ok).toBe(false);
  });

  it("rejects a completely wrong shape", () => {
    expect(validateExtraction({ hello: "world" }).ok).toBe(false);
    expect(validateExtraction(null).ok).toBe(false);
    expect(validateExtraction("string").ok).toBe(false);
  });

  it("trims and drops empty strings in list fields", () => {
    const res = validateExtraction({
      metadata: {}, scope: [],
      inclusions: ["  keep  ", "", "  "],
      exclusions: [], compliance: {}, primaryTrade: "other", warnings: [],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.inclusions).toEqual(["keep"]);
  });
});
