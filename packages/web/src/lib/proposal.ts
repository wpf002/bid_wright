import type { BidLineItem, ExtractionResult } from "@bidwright/shared";
import type { BidRow, CompanyProfile } from "./api";

/**
 * Shaping a bid into a proposal.
 *
 * Pure, so the narrative and pagination arithmetic can be tested without a PDF
 * writer or a DOM.
 */

export const DEFAULT_BRAND = "#d97706";

/** A hex colour as RGB, for PDF writers that take numeric channels. */
export function hexToRgb(hex: string | null | undefined): [number, number, number] {
  const value = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!value) return hexToRgb(DEFAULT_BRAND);
  const int = parseInt(value[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export interface ProposalDoc {
  company: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    license: string | null;
    brandColor: string;
    logoDataUrl: string | null;
  };
  project: {
    name: string;
    address: string | null;
    generalContractor: string | null;
    owner: string | null;
    bidDeadline: string | null;
  };
  summary: string;
  scopeNarrative: string[];
  lineItems: BidLineItem[];
  assumptions: string[];
  clarifications: string[];
  exclusions: string[];
  overheadPercent: number;
  profitPercent: number;
  validityDays: number;
  terms: string;
  dateIssued: string;
}

const DEFAULT_TERMS =
  "Payment terms net 30 from invoice date. This proposal is subject to a mutually acceptable subcontract agreement. " +
  "Pricing is based on the documents listed and any addenda issued prior to the date of this proposal.";

/**
 * One-paragraph summary an estimator would otherwise type by hand.
 * Assembled from the bid, not written by the model — an exported proposal is a
 * commercial document, and every number in it must be traceable.
 */
export function executiveSummary(doc: {
  companyName: string;
  projectName: string;
  gc: string | null;
  itemCount: number;
  trade: string | null;
  validityDays: number;
}): string {
  const trade = (doc.trade ?? "").replace(/_/g, " ");
  const scope = trade ? `${trade} scope` : "scope";
  const to = doc.gc ? ` to ${doc.gc}` : "";
  return (
    `${doc.companyName} is pleased to submit this proposal${to} for the ${scope} of work at ${doc.projectName}. ` +
    `Our proposal covers ${doc.itemCount} line ${doc.itemCount === 1 ? "item" : "items"} as detailed below, ` +
    `subject to the assumptions, clarifications, and exclusions stated. ` +
    `This proposal is valid for ${doc.validityDays} days from the date of issue.`
  );
}

/** Scope narrative: the extracted scope, in the order the ITB stated it. */
export function scopeNarrative(extraction: ExtractionResult | null, lineItems: BidLineItem[]): string[] {
  const scope = extraction?.scope ?? [];
  if (scope.length > 0) {
    return scope.map((s) =>
      s.quantity !== null && s.unit
        ? `${s.description} — approximately ${s.quantity} ${s.unit}.`
        : `${s.description}.`,
    );
  }
  // No extraction (a hand-built bid): fall back to the line items themselves.
  return lineItems.map((li) => `${li.description} — ${li.quantity} ${li.unit}.`);
}

export function buildProposalDoc(
  bid: BidRow,
  profile: CompanyProfile | null,
  logoDataUrl: string | null,
  now = new Date(),
): ProposalDoc {
  const extraction = (bid.extraction ?? null) as ExtractionResult | null;
  const m = extraction?.metadata;
  const companyName = profile?.companyName?.trim() || "Your Company";
  const projectName = bid.projectName ?? bid.itbFileName;

  return {
    company: {
      name: companyName,
      address: profile?.companyAddress ?? null,
      phone: profile?.companyPhone ?? null,
      email: profile?.companyEmail ?? null,
      license: profile?.companyLicense ?? null,
      brandColor: profile?.brandColor ?? DEFAULT_BRAND,
      logoDataUrl,
    },
    project: {
      name: projectName,
      address: m?.projectAddress ?? null,
      generalContractor: bid.gcName ?? m?.generalContractor ?? null,
      owner: bid.ownerName ?? m?.owner ?? null,
      bidDeadline: m?.bidDeadline ?? null,
    },
    summary: executiveSummary({
      companyName,
      projectName,
      gc: bid.gcName ?? m?.generalContractor ?? null,
      itemCount: bid.lineItems?.length ?? 0,
      trade: bid.primaryTrade,
      validityDays: bid.validityDays,
    }),
    scopeNarrative: scopeNarrative(extraction, bid.lineItems ?? []),
    lineItems: bid.lineItems ?? [],
    assumptions: bid.assumptions ?? [],
    clarifications: bid.clarifications ?? [],
    exclusions: bid.exclusions ?? [],
    overheadPercent: bid.overheadPercent,
    profitPercent: bid.profitPercent,
    validityDays: bid.validityDays,
    terms: profile?.proposalTerms?.trim() || DEFAULT_TERMS,
    dateIssued: now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  };
}
