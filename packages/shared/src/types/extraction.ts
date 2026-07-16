import type { Trade } from "./trade";

export interface ScopeItem {
  id: string;
  description: string;
  trade: Trade;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  confidence: number;
  sourcePage: number | null;
}

export interface ProjectMetadata {
  projectName: string | null;
  projectAddress: string | null;
  /** The project owner (e.g. the school district). Distinct from the GC. */
  owner: string | null;
  /** The general contractor soliciting the bid — who the sub responds to. */
  generalContractor: string | null;
  bidDeadline: string | null;
  rfiDeadline: string | null;
  walkthroughDate: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface ComplianceRequirements {
  bondRequired: boolean;
  bondPercent: number | null;
  insuranceRequired: boolean;
  insuranceLimits: string[];
  licenseRequirements: string[];
  prevailingWage: boolean;
  unionRequired: boolean;
  davisBacon: boolean;
  prequalRequired: boolean;
  otherRequirements: string[];
}

export interface ExtractionResult {
  metadata: ProjectMetadata;
  scope: ScopeItem[];
  inclusions: string[];
  exclusions: string[];
  compliance: ComplianceRequirements;
  primaryTrade: Trade;
  warnings: string[];
  rawTextPreview: string;
  pageCount: number;
}
