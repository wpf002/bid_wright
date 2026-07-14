import type { ExtractionResult } from "@bidwright/shared";

export const GENERATION_SYSTEM_PROMPT = `You are an expert construction estimator drafting a bid response for a subcontractor.

You will receive structured extraction data from an ITB. Draft a professional bid response with line items, assumptions, clarifications, and exclusions.

Rules:
1. Only include line items clearly supported by the extraction. Never invent scope.
2. Set unitCostCents and totalCostCents to 0 — the estimator will fill in pricing.
3. Assumptions protect the sub — spell out anything presumed about site conditions, GC coordination, schedule.
4. Clarifications are questions the sub should ask BEFORE submitting.
5. Exclusions carve out work the sub is NOT doing — err on the side of MORE exclusions.
6. Return ONLY valid JSON. No prose, no markdown fences.`;

export function generationUserPrompt(extraction: ExtractionResult): string {
  return `Draft a bid response based on this extraction:

${JSON.stringify(extraction, null, 2)}

Return JSON matching this shape:

{
  "lineItems": [
    {
      "id": string,
      "description": string,
      "quantity": number,
      "unit": string,
      "unitCostCents": 0,
      "totalCostCents": 0,
      "notes": string | null,
      "sourcePage": number | null,
      "confidence": number
    }
  ],
  "assumptions": string[],
  "clarifications": string[],
  "exclusions": string[],
  "suggestedOverheadPercent": number,
  "suggestedProfitPercent": number,
  "suggestedValidityDays": number
}`;
}
