import { describe, it, expect } from "vitest";
import type { BidLineItem } from "@bidwright/shared";
import type { BidRow, CompanyProfile } from "../src/lib/api";
import { hexToRgb, executiveSummary, scopeNarrative, buildProposalDoc, DEFAULT_BRAND } from "../src/lib/proposal";

function li(p: Partial<BidLineItem> = {}): BidLineItem {
  return {
    id: "1", description: "Install EMT conduit", quantity: 100, unit: "LF",
    unitCostCents: 375, totalCostCents: 37500, notes: null, sourcePage: 2, confidence: null,
    ...p,
  };
}

function bid(p: Partial<BidRow> = {}): BidRow {
  return {
    id: "b1", userId: "u1", itbFileName: "northside-itb.pdf",
    projectName: "Northside Elementary — Electrical", gcName: "Turner Ridge Construction, LLC",
    ownerName: "Dallas ISD", bidDeadline: null, primaryTrade: "electrical", status: "draft",
    extraction: {
      metadata: { projectAddress: "1420 Maple Ave", bidDeadline: "August 12, 2026" },
      scope: [
        { id: "s1", description: "Demolish existing fixtures", trade: "electrical", quantity: 240, unit: "EA", notes: null, confidence: 0.95, sourcePage: 2 },
        { id: "s2", description: "Coordinate with the GC", trade: "electrical", quantity: null, unit: null, notes: null, confidence: 0.8, sourcePage: 2 },
      ],
    } as never,
    lineItems: [li()], assumptions: ["Normal hours."], clarifications: ["Confirm shutdowns."],
    exclusions: ["Permits."], subtotalCents: 37500, overheadPercent: 10, profitPercent: 8,
    totalCents: 44250, validityDays: 30, outcome: null,
    createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z",
    ...p,
  };
}

const profile: CompanyProfile = {
  companyName: "Foti Electric", brandColor: "#2563eb", companyAddress: "500 Main St, Dallas TX",
  companyPhone: "(214) 555-0100", companyEmail: "bids@fotielectric.com",
  companyLicense: "TECL-12345", proposalTerms: "Net 15.", hasLogo: false,
};

describe("hexToRgb", () => {
  it("parses hex with or without a hash", () => {
    expect(hexToRgb("#2563eb")).toEqual([37, 99, 235]);
    expect(hexToRgb("2563eb")).toEqual([37, 99, 235]);
  });
  it("falls back to the brand default for junk rather than throwing", () => {
    // This value reaches a PDF writer; a bad colour must not break an export.
    expect(hexToRgb("not-a-colour")).toEqual(hexToRgb(DEFAULT_BRAND));
    expect(hexToRgb(null)).toEqual(hexToRgb(DEFAULT_BRAND));
    expect(hexToRgb("")).toEqual(hexToRgb(DEFAULT_BRAND));
  });
});

describe("executiveSummary", () => {
  const base = { companyName: "Foti Electric", projectName: "Northside", gc: "Turner Ridge", itemCount: 6, trade: "electrical", validityDays: 30 };

  it("names the company, GC, project, and validity", () => {
    const s = executiveSummary(base);
    expect(s).toContain("Foti Electric");
    expect(s).toContain("Turner Ridge");
    expect(s).toContain("Northside");
    expect(s).toContain("30 days");
  });

  it("reads naturally with one line item", () => {
    expect(executiveSummary({ ...base, itemCount: 1 })).toContain("1 line item");
    expect(executiveSummary({ ...base, itemCount: 2 })).toContain("2 line items");
  });

  it("handles a missing GC and trade without leaving gaps", () => {
    const s = executiveSummary({ ...base, gc: null, trade: null });
    expect(s).not.toContain("null");
    expect(s).not.toContain("undefined");
    expect(s).toContain("scope of work");
  });

  it("humanizes an underscored trade", () => {
    expect(executiveSummary({ ...base, trade: "fire_protection" })).toContain("fire protection");
  });
});

describe("scopeNarrative", () => {
  it("uses the extracted scope, with quantities where known", () => {
    const lines = scopeNarrative(bid().extraction as never, []);
    expect(lines[0]).toContain("approximately 240 EA");
    // A scope item with no quantity shouldn't invent one.
    expect(lines[1]).toBe("Coordinate with the GC.");
  });

  it("falls back to line items when there's no extraction", () => {
    const lines = scopeNarrative(null, [li({ description: "Pull wire", quantity: 500, unit: "LF" })]);
    expect(lines).toEqual(["Pull wire — 500 LF."]);
  });

  it("is empty when there's nothing to say", () => {
    expect(scopeNarrative(null, [])).toEqual([]);
  });
});

describe("buildProposalDoc", () => {
  const now = new Date("2026-07-16T12:00:00Z");

  it("assembles company, project, and content", () => {
    const doc = buildProposalDoc(bid(), profile, null, now);
    expect(doc.company.name).toBe("Foti Electric");
    expect(doc.company.license).toBe("TECL-12345");
    expect(doc.project.generalContractor).toBe("Turner Ridge Construction, LLC");
    expect(doc.project.address).toBe("1420 Maple Ave");
    expect(doc.terms).toBe("Net 15.");
    expect(doc.dateIssued).toContain("2026");
  });

  it("falls back sensibly with no profile at all", () => {
    const doc = buildProposalDoc(bid(), null, null, now);
    expect(doc.company.name).toBe("Your Company");
    expect(doc.company.brandColor).toBe(DEFAULT_BRAND);
    // A user who never set terms still gets a usable proposal.
    expect(doc.terms.length).toBeGreaterThan(20);
  });

  it("prefers the bid's GC over the extracted one", () => {
    // The estimator may have corrected it by hand; that wins.
    const doc = buildProposalDoc(bid({ gcName: "Corrected GC" }), profile, null, now);
    expect(doc.project.generalContractor).toBe("Corrected GC");
  });

  it("falls back to the ITB filename when a project has no name", () => {
    const doc = buildProposalDoc(bid({ projectName: null }), profile, null, now);
    expect(doc.project.name).toBe("northside-itb.pdf");
  });

  it("carries the logo data url through", () => {
    const doc = buildProposalDoc(bid(), profile, "data:image/png;base64,AAA", now);
    expect(doc.company.logoDataUrl).toBe("data:image/png;base64,AAA");
  });
});
