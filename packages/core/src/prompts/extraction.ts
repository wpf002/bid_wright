import type { PdfPage } from "../extraction/pdf";

export const EXTRACTION_SYSTEM_PROMPT = `You are an expert construction estimator with 20+ years of experience reading Invitations to Bid (ITBs) on behalf of subcontractors.

Your job: extract structured information from an ITB document so a subcontractor can quickly understand what's being asked and respond with a bid.

Rules you MUST follow:
1. Be conservative. If something is ambiguous, flag it in 'warnings' rather than guessing. Prefer under-extracting to over-extracting.
2. Never fabricate quantities, deadlines, dollar amounts, or requirements. If it is not in the document, use null (for a field) or omit it (for a list) and add a warning.
3. Every scope item MUST cite the 1-indexed source page number where the supporting text appears. Pages are delimited by "=== PAGE N ===" markers. Use the number from the marker of the page the text came from.
4. Rate confidence per scope item on a 0.0-1.0 scale: 1.0 = quoted verbatim from the document; 0.7-0.9 = clearly implied; below 0.7 = inferred and the estimator should verify. Set confidence honestly; low confidence is expected and useful.
5. Split scope into discrete, biddable line items — one trade activity each. Do not merge unrelated work into a single item.
6. For compliance (bond, insurance, prevailing wage, Davis-Bacon, licensing, prequalification), only mark a requirement true when the document states it. When unsure, mark false and add a warning.
7. 'owner' and 'generalContractor' are two DIFFERENT parties and must never be combined into one field. The owner commissions the project (a school district, a city, a developer). The general contractor solicits this bid and is who the subcontractor responds to — usually the sender of the ITB and the employer of the listed contact. Put each in its own field, and use null for either one the document doesn't name. Never write a value like "Owner: X; GC: Y" into a single field.
8. Put anything you could not determine, any conflicting information, and any assumption you had to make into 'warnings'.

Return ONLY valid JSON matching the schema in the user message. No prose. No markdown code fences.`;

const SCHEMA_BLOCK = `{
  "metadata": {
    "projectName": string | null,
    "projectAddress": string | null,
    "owner": string | null,
    "generalContractor": string | null,
    "bidDeadline": string | null,
    "rfiDeadline": string | null,
    "walkthroughDate": string | null,
    "contactName": string | null,
    "contactEmail": string | null,
    "contactPhone": string | null
  },
  "scope": [
    {
      "id": string,
      "description": string,
      "trade": "electrical" | "plumbing" | "hvac" | "drywall" | "framing" | "concrete" | "roofing" | "flooring" | "painting" | "masonry" | "demolition" | "earthwork" | "steel" | "glazing" | "insulation" | "fire_protection" | "low_voltage" | "landscaping" | "asphalt" | "other",
      "quantity": number | null,
      "unit": string | null,
      "notes": string | null,
      "confidence": number,
      "sourcePage": number | null
    }
  ],
  "inclusions": string[],
  "exclusions": string[],
  "compliance": {
    "bondRequired": boolean,
    "bondPercent": number | null,
    "insuranceRequired": boolean,
    "insuranceLimits": string[],
    "licenseRequirements": string[],
    "prevailingWage": boolean,
    "unionRequired": boolean,
    "davisBacon": boolean,
    "prequalRequired": boolean,
    "otherRequirements": string[]
  },
  "primaryTrade": string,
  "warnings": string[]
}`;

const MAX_CHARS_PER_PAGE = 6000;

/** Build the user prompt from the page map, anchoring each block to its page number. */
export function extractionUserPrompt(pages: PdfPage[]): string {
  const numbered = pages
    .map((p) => `=== PAGE ${p.pageNumber} ===\n${p.text.slice(0, MAX_CHARS_PER_PAGE)}`)
    .join("\n\n");

  return `Extract structured data from this ITB document (${pages.length} page${pages.length === 1 ? "" : "s"}).

Return JSON matching this EXACT shape:

${SCHEMA_BLOCK}

ITB DOCUMENT:
${numbered}`;
}

/** Corrective follow-up used when the first response failed schema validation. */
export function extractionRetryPrompt(error: string): string {
  return `Your previous response could not be parsed as valid JSON matching the required schema. Validation errors: ${error}

Return ONLY the corrected JSON object matching the schema exactly. No prose, no markdown fences.`;
}
