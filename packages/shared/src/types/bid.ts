import type { ExtractionResult } from "./extraction";
import type { Cents } from "./money";

export type BidStatus =
  | "draft" | "in_review" | "submitted" | "won" | "lost" | "withdrawn";

export interface BidLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitCostCents: Cents;
  totalCostCents: Cents;
  notes: string | null;
  sourcePage: number | null;
  confidence: number | null;
}

export interface BidResponse {
  id: string;
  itbFileName: string;
  status: BidStatus;
  createdAt: string;
  updatedAt: string;
  extraction: ExtractionResult;
  lineItems: BidLineItem[];
  assumptions: string[];
  clarifications: string[];
  exclusions: string[];
  subtotalCents: Cents;
  overheadPercent: number;
  profitPercent: number;
  totalCents: Cents;
  validityDays: number;
  outcome?: {
    result: "won" | "lost" | "withdrawn";
    reason?: string;
    notedAt: string;
  };
}
