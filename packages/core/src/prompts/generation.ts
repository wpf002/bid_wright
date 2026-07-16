import type { ExtractionResult, Trade } from "@bidwright/shared";
import { TRADE_LABELS } from "@bidwright/shared";
import { ASSUMPTION_LIBRARY, CLARIFICATION_LIBRARY, EXCLUSION_LIBRARY } from "../libraries";
import { textsForTrade } from "../libraries/types";

export const GENERATION_SYSTEM_PROMPT = `You are an expert construction estimator drafting a bid response on behalf of a subcontractor.

You will receive structured extraction data from an ITB. Draft a professional bid response with line items, assumptions, clarifications, and exclusions.

Rules you MUST follow:
1. Only include line items clearly supported by the extraction. Never invent scope that isn't there.
2. NEVER include pricing. Do not output unit costs, totals, or any dollar amount — the estimator prices the bid. Your job is scope, quantity, and unit only.
3. Be conservative on quantities. Carry forward the quantity from the extraction when present. When a quantity is absent or ambiguous, use unit "LS" (lump sum) with quantity 1 and say so in 'notes'.
4. Anything requiring the subcontractor's input — an unverified quantity, an unclear boundary, a field measurement — must be called out in 'notes' on the line item AND raised as a clarification.
5. Carry each line item's sourcePage through from the extraction's scope item so the estimator can click back to the source.
6. Assumptions protect the sub: state what you presume about site conditions, GC coordination, and schedule.
7. Clarifications are questions the sub should ask the GC BEFORE submitting.
8. Exclusions carve out work the sub is NOT doing. Err on the side of MORE exclusions.
9. You will be given candidate assumptions/clarifications/exclusions for this trade. Prefer them when they fit — reuse the exact wording. Add your own only when the project needs something the candidates don't cover, and drop any candidate that is irrelevant or contradicted by the ITB.
10. Return ONLY valid JSON. No prose, no markdown fences.`;

const SCHEMA_BLOCK = `{
  "lineItems": [
    {
      "description": string,
      "quantity": number,
      "unit": string,
      "notes": string | null,
      "sourcePage": number | null
    }
  ],
  "assumptions": string[],
  "clarifications": string[],
  "exclusions": string[],
  "suggestedOverheadPercent": number,
  "suggestedProfitPercent": number,
  "suggestedValidityDays": number
}`;

/** Cap candidate lists so the prompt stays focused. */
const MAX_CANDIDATES = 24;

function candidateBlock(title: string, texts: string[]): string {
  const list = texts.slice(0, MAX_CANDIDATES).map((t) => `- ${t}`).join("\n");
  return `${title}:\n${list}`;
}

export function generationUserPrompt(extraction: ExtractionResult, trade?: Trade): string {
  const primaryTrade = trade ?? extraction.primaryTrade;
  const tradeLabel = TRADE_LABELS[primaryTrade] ?? primaryTrade;

  const assumptions = textsForTrade(ASSUMPTION_LIBRARY, primaryTrade);
  const clarifications = textsForTrade(CLARIFICATION_LIBRARY, primaryTrade);
  const exclusions = textsForTrade(EXCLUSION_LIBRARY, primaryTrade);

  return `Draft a bid response for a ${tradeLabel} subcontractor based on this ITB extraction.

EXTRACTION:
${JSON.stringify(extraction, null, 2)}

CANDIDATE CLAUSES FOR ${tradeLabel.toUpperCase()} — prefer these, reuse the wording verbatim where they fit:

${candidateBlock("ASSUMPTIONS", assumptions)}

${candidateBlock("CLARIFICATIONS", clarifications)}

${candidateBlock("EXCLUSIONS", exclusions)}

Return JSON matching this EXACT shape (no pricing fields):

${SCHEMA_BLOCK}`;
}

/** Corrective follow-up used when the first draft failed schema validation. */
export function generationRetryPrompt(error: string): string {
  return `Your previous response could not be parsed as valid JSON matching the required schema. Validation errors: ${error}

Return ONLY the corrected JSON object matching the schema exactly. No prose, no markdown fences.`;
}
