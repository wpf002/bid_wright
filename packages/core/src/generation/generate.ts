import Anthropic from "@anthropic-ai/sdk";
import type { BidResponse, ExtractionResult } from "@bidwright/shared";
import { GENERATION_SYSTEM_PROMPT, generationUserPrompt } from "../prompts/generation";
import type { GenerationOptions } from "../types";
import { randomUUID } from "node:crypto";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DEFAULT_MODEL = "claude-opus-4-7";

export async function generateBidResponse(
  extraction: ExtractionResult,
  itbFileName: string,
  opts: GenerationOptions = {},
): Promise<BidResponse> {
  const response = await client.messages.create({
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    system: GENERATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: generationUserPrompt(extraction) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const cleaned = textBlock.text.replace(/```json\n?|```/g, "").trim();
  const draft = JSON.parse(cleaned);

  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    itbFileName,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    extraction,
    lineItems: draft.lineItems,
    assumptions: draft.assumptions ?? [],
    clarifications: draft.clarifications ?? [],
    exclusions: draft.exclusions ?? [],
    subtotalCents: 0,
    overheadPercent: draft.suggestedOverheadPercent ?? 10,
    profitPercent: draft.suggestedProfitPercent ?? 10,
    totalCents: 0,
    validityDays: draft.suggestedValidityDays ?? 30,
  };
}
