import Anthropic from "@anthropic-ai/sdk";
import type { BidResponse, BidLineItem, ExtractionResult } from "@bidwright/shared";
import { GENERATION_SYSTEM_PROMPT, generationUserPrompt, generationRetryPrompt } from "../prompts/generation";
import { validateGenerationDraft, type GenerationDraft } from "./schema";
import { computeBidTotals } from "./totals";
import { extractJsonBlock, type MessagesClient } from "../extraction/extract";
import type { GenerationOptions } from "../types";
import { randomUUID } from "node:crypto";

const DEFAULT_MODEL = "claude-opus-4-8";
const DEFAULT_MAX_TOKENS = 8000;

let defaultClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!defaultClient) defaultClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return defaultClient;
}

function textOf(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("No text response from Claude");
  return block.text;
}

/**
 * Parse + validate a raw model reply into a generation draft.
 * Pure (no network) so the parse/validate path is unit-testable.
 */
export function parseGenerationResponse(rawText: string) {
  const json = extractJsonBlock(rawText);
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (err) {
    return { ok: false as const, error: `JSON parse failed: ${(err as Error).message}` };
  }
  return validateGenerationDraft(data);
}

/**
 * Turn a validated draft into priced-at-zero line items. The estimator fills in
 * unit costs, so cost fields start at 0 and confidence starts null — we never
 * let the model originate money.
 */
export function draftToLineItems(draft: GenerationDraft): BidLineItem[] {
  return draft.lineItems.map((li) => ({
    id: randomUUID(),
    description: li.description,
    quantity: li.quantity,
    unit: li.unit,
    unitCostCents: 0,
    totalCostCents: 0,
    notes: li.notes,
    sourcePage: li.sourcePage,
    confidence: null,
  }));
}

/** Assemble a complete BidResponse from a validated draft. */
export function draftToBidResponse(
  draft: GenerationDraft,
  extraction: ExtractionResult,
  itbFileName: string,
  now = new Date().toISOString(),
): BidResponse {
  const lineItems = draftToLineItems(draft);
  const overheadPercent = draft.suggestedOverheadPercent;
  const profitPercent = draft.suggestedProfitPercent;
  const { subtotalCents, totalCents } = computeBidTotals(lineItems, overheadPercent, profitPercent);

  return {
    id: randomUUID(),
    itbFileName,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    extraction,
    lineItems,
    assumptions: draft.assumptions,
    clarifications: draft.clarifications,
    exclusions: draft.exclusions,
    subtotalCents,
    overheadPercent,
    profitPercent,
    totalCents,
    validityDays: draft.suggestedValidityDays,
  };
}

/**
 * Draft a bid response from an extraction. Validates the model output with zod
 * and retries once with a corrective prompt if the first reply is invalid.
 */
export async function generateBidResponse(
  extraction: ExtractionResult,
  itbFileName: string,
  opts: GenerationOptions & { client?: MessagesClient; pastDescriptions?: string[] } = {},
): Promise<BidResponse> {
  const client = opts.client ?? getClient();
  const model = opts.model ?? DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const trade = (opts.trade as ExtractionResult["primaryTrade"]) ?? extraction.primaryTrade;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: generationUserPrompt(extraction, trade, opts.pastDescriptions ?? []) },
  ];

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: GENERATION_SYSTEM_PROMPT,
      messages,
    });
    const raw = textOf(response);
    const result = parseGenerationResponse(raw);
    if (result.ok) {
      return draftToBidResponse(result.value, extraction, itbFileName);
    }
    lastError = result.error;
    messages.push({ role: "assistant", content: raw });
    messages.push({ role: "user", content: generationRetryPrompt(result.error) });
  }

  throw new Error(`Bid generation failed after retry: ${lastError}`);
}
