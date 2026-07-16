import { describe, it, expect } from "vitest";
import { TRADE_LABELS, type Trade } from "@bidwright/shared";
import {
  ASSUMPTION_LIBRARY,
  CLARIFICATION_LIBRARY,
  EXCLUSION_LIBRARY,
} from "../src/libraries";
import { forTrade, textsForTrade } from "../src/libraries/types";

const ALL_TRADES = Object.keys(TRADE_LABELS) as Trade[];
const LIBS = {
  assumptions: ASSUMPTION_LIBRARY,
  clarifications: CLARIFICATION_LIBRARY,
  exclusions: EXCLUSION_LIBRARY,
};

describe("clause libraries meet roadmap seed targets", () => {
  it("seeds 50+ assumptions", () => {
    expect(ASSUMPTION_LIBRARY.length).toBeGreaterThanOrEqual(50);
  });
  it("seeds 30+ clarifications", () => {
    expect(CLARIFICATION_LIBRARY.length).toBeGreaterThanOrEqual(30);
  });
  it("seeds 40+ exclusions", () => {
    expect(EXCLUSION_LIBRARY.length).toBeGreaterThanOrEqual(40);
  });
});

describe("clause library integrity", () => {
  for (const [name, lib] of Object.entries(LIBS)) {
    it(`${name}: ids are unique`, () => {
      const ids = lib.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it(`${name}: every clause has non-empty text`, () => {
      for (const c of lib) expect(c.text.trim().length).toBeGreaterThan(0);
    });

    it(`${name}: every declared trade is a real trade`, () => {
      for (const c of lib) {
        for (const t of c.trades) expect(ALL_TRADES).toContain(t);
      }
    });

    it(`${name}: text is not duplicated`, () => {
      const texts = lib.map((c) => c.text);
      expect(new Set(texts).size).toBe(texts.length);
    });
  }
});

describe("forTrade", () => {
  it("returns general clauses plus that trade's own", () => {
    const electrical = forTrade(ASSUMPTION_LIBRARY, "electrical");
    // includes a general clause
    expect(electrical.some((c) => c.id === "asm-normal-hours")).toBe(true);
    // includes an electrical-specific clause
    expect(electrical.some((c) => c.id === "asm-elec-existing-service")).toBe(true);
    // excludes another trade's clause
    expect(electrical.some((c) => c.id === "asm-roof-deck-sound")).toBe(false);
  });

  it("orders trade-specific clauses before general ones", () => {
    // The prompt caps candidate lists, so trade-specific clauses must lead or
    // they get sliced away — which would silently defeat trade-awareness.
    const electrical = forTrade(EXCLUSION_LIBRARY, "electrical");
    const firstGeneral = electrical.findIndex((c) => c.trades.length === 0);
    const lastSpecific = electrical.map((c) => c.trades.length > 0).lastIndexOf(true);
    expect(lastSpecific).toBeLessThan(firstGeneral);
  });

  it("keeps trade-specific clauses within the prompt's 24-candidate cap", () => {
    for (const lib of [ASSUMPTION_LIBRARY, CLARIFICATION_LIBRARY, EXCLUSION_LIBRARY]) {
      for (const trade of ALL_TRADES) {
        const specific = lib.filter((c) => c.trades.includes(trade));
        const capped = forTrade(lib, trade).slice(0, 24);
        for (const c of specific) expect(capped).toContain(c);
      }
    }
  });

  it("returns only general clauses for a trade with no specifics", () => {
    const landscaping = forTrade(ASSUMPTION_LIBRARY, "landscaping");
    expect(landscaping.every((c) => c.trades.length === 0)).toBe(true);
    expect(landscaping.length).toBeGreaterThan(0);
  });

  it("textsForTrade returns plain strings", () => {
    const texts = textsForTrade(EXCLUSION_LIBRARY, "hvac");
    expect(texts.every((t) => typeof t === "string")).toBe(true);
    expect(texts).toContain("Testing, adjusting, and balancing.");
  });
});

describe("every trade can satisfy the Phase 2 exit criteria", () => {
  // >=3 assumptions, >=3 clarifications, >=5 exclusions must be available.
  for (const trade of ALL_TRADES) {
    it(`${trade} has enough candidate clauses`, () => {
      expect(forTrade(ASSUMPTION_LIBRARY, trade).length).toBeGreaterThanOrEqual(3);
      expect(forTrade(CLARIFICATION_LIBRARY, trade).length).toBeGreaterThanOrEqual(3);
      expect(forTrade(EXCLUSION_LIBRARY, trade).length).toBeGreaterThanOrEqual(5);
    });
  }
});
