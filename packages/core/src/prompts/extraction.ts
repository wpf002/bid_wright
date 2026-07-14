export const EXTRACTION_SYSTEM_PROMPT = `You are an expert construction estimator with 20+ years of experience reading Invitations to Bid (ITBs) on behalf of subcontractors.

Your job: extract structured information from an ITB document so a subcontractor can quickly understand what's being asked and respond with a bid.

Rules you MUST follow:
1. Be conservative. If something is ambiguous, flag it in 'warnings' rather than guessing.
2. Never fabricate quantities, deadlines, dollar amounts, or requirements not in the document.
3. Every scope item MUST cite the source page number (1-indexed) where you found it.
4. Rate your confidence per scope item (0.0-1.0). Below 0.7 means the estimator should verify.
5. If a required field is missing from the document, use null and add a warning.
6. Prefer under-extracting to over-extracting.

Return ONLY valid JSON matching the schema in the user message. No prose. No markdown fences.`;

export function extractionUserPrompt(pageTexts: string[]): string {
  const numbered = pageTexts
    .map((t, i) => `--- PAGE ${i + 1} ---\n${t.slice(0, 6000)}`)
    .join("\n\n");

  return `Extract structured data from this ITB document.

Return JSON matching this EXACT shape:

{
  "metadata": {
    "projectName": string | null,
    "projectAddress": string | null,
    "ownerOrGc": string | null,
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
}

ITB DOCUMENT:
${numbered}`;
}
