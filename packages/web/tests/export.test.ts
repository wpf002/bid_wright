import { describe, it, expect } from "vitest";
import type { BidLineItem } from "@bidwright/shared";
import { csvField, toCsvRow, lineItemsToCsv, exportFileName } from "../src/lib/export";
import { fuzzyMatch } from "../src/lib/command";

function li(p: Partial<BidLineItem> = {}): BidLineItem {
  return {
    id: "1", description: "Item", quantity: 1, unit: "EA",
    unitCostCents: 0, totalCostCents: 0, notes: null, sourcePage: null, confidence: null,
    ...p,
  };
}

describe("csvField", () => {
  it("leaves plain values alone", () => {
    expect(csvField("Install conduit")).toBe("Install conduit");
    expect(csvField(240)).toBe("240");
  });

  it("quotes fields containing commas, quotes, or newlines", () => {
    expect(csvField("Demolish, remove")).toBe('"Demolish, remove"');
    expect(csvField('2" conduit')).toBe('"2"" conduit"');
    expect(csvField("line one\nline two")).toBe('"line one\nline two"');
  });

  it("neutralizes formula injection", () => {
    // Excel would otherwise execute these. ITB text really can start with "=".
    expect(csvField("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvField("+1-555")).toBe("'+1-555");
    expect(csvField("-cmd")).toBe("'-cmd");
    expect(csvField("@import")).toBe("'@import");
  });

  it("renders null and undefined as empty", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });
});

describe("toCsvRow", () => {
  it("joins fields with commas", () => {
    expect(toCsvRow(["a", "b", 1])).toBe("a,b,1");
  });
  it("escapes each field", () => {
    expect(toCsvRow(["a,b", "c"])).toBe('"a,b",c');
  });
});

describe("lineItemsToCsv", () => {
  const bid = {
    lineItems: [
      li({ description: "Demolish fixtures", quantity: 240, unit: "EA", unitCostCents: 1250, totalCostCents: 300000, sourcePage: 2 }),
      li({ description: 'Install 2" conduit, EMT', quantity: 3500, unit: "LF", unitCostCents: 375, totalCostCents: 1312500 }),
    ],
    overheadPercent: 10,
    profitPercent: 8,
  };
  const csv = lineItemsToCsv(bid);
  const lines = csv.split("\r\n");

  it("starts with a header row", () => {
    expect(lines[0]).toBe("Description,Quantity,Unit,Unit Cost,Total,Source Page,Notes");
  });

  it("writes money as plain decimal strings derived from integer cents", () => {
    expect(lines[1]).toContain("240,EA,12.50,3000.00,2");
  });

  it("escapes a description containing a comma and a quote", () => {
    expect(lines[2]).toContain('"Install 2"" conduit, EMT"');
  });

  it("includes subtotal, overhead, profit, and total", () => {
    expect(csv).toContain("Subtotal,16125.00");
    expect(csv).toContain("Overhead (10%),1612.50");
    expect(csv).toContain("Profit (8%),1290.00");
    expect(csv).toContain("Total,19027.50");
  });

  it("uses CRLF line endings per RFC 4180", () => {
    expect(csv).toContain("\r\n");
  });

  it("handles an empty bid", () => {
    const empty = lineItemsToCsv({ lineItems: [], overheadPercent: 10, profitPercent: 10 });
    expect(empty).toContain("Total,0.00");
  });
});

describe("exportFileName", () => {
  it("slugifies the project name, collapsing punctuation and runs of space", () => {
    expect(exportFileName({ projectName: "Northside Elementary — Electrical", itbFileName: "x.pdf" }, "pdf"))
      .toBe("northside-elementary-electrical.pdf");
  });
  it("falls back to the ITB filename", () => {
    expect(exportFileName({ projectName: null, itbFileName: "itb-2026.pdf" }, "csv")).toBe("itb-2026.csv");
  });
  it("never produces an empty basename", () => {
    expect(exportFileName({ projectName: "***", itbFileName: "***.pdf" }, "docx")).toBe("bid.docx");
  });
});

describe("fuzzyMatch", () => {
  it("matches a subsequence", () => {
    expect(fuzzyMatch("Northside Elementary", "nel")).toBe(true);
    expect(fuzzyMatch("Northside Elementary", "north")).toBe(true);
  });
  it("is case- and space-insensitive", () => {
    expect(fuzzyMatch("Bid Board", "BB")).toBe(true);
    expect(fuzzyMatch("Bid Board", "bid board")).toBe(true);
  });
  it("returns everything for an empty query", () => {
    expect(fuzzyMatch("anything", "  ")).toBe(true);
  });
  it("rejects a non-subsequence", () => {
    expect(fuzzyMatch("Northside", "xyz")).toBe(false);
    // order matters: the letters must appear in sequence
    expect(fuzzyMatch("abc", "cba")).toBe(false);
  });
});
