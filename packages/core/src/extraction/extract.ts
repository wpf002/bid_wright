import Anthropic from "@anthropic-ai/sdk";
import type { ExtractionResult } from "@bidwright/shared";
import { parsePdf } from "./pdf";
import type { PdfPage } from "./pdf";
import {
  EXTRACTION_SYSTEM_PROMPT,
  extractionUserPrompt,
  extractionRetryPrompt,
} from "../prompts/extraction";
import { validateExtraction } from "./schema";
import type { ExtractionOptions } from "../types";

const DEFAULT_MODEL = "claude-opus-4-8";
const DEFAULT_MAX_TOKENS = 8000;

let defaultClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!defaultClient) defaultClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return defaultClient;
}

/** Minimal surface of the Anthropic client we depend on — lets tests inject a fake. */
export interface MessagesClient {
  messages: {
    create(body: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

/** Strip markdown fences and pull the outermost JSON object from a model reply. */
export function extractJsonBlock(text: string): string {
  const withoutFences = text.replace(/```(?:json)?\s*|\s*```/g, "").trim();
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return withoutFences;
  return withoutFences.slice(start, end + 1);
}

function textOf(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("No text response from Claude");
  return block.text;
}

/**
 * Parse + validate a raw model reply into a normalized extraction core.
 * Pure (no network) so the parse/validate path is unit-testable.
 */
export function parseExtractionResponse(rawText: string, pageCount: number) {
  const json = extractJsonBlock(rawText);
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (err) {
    return { ok: false as const, error: `JSON parse failed: ${(err as Error).message}` };
  }
  return validateExtraction(data, { pageCount });
}

export async function extractFromPdf(
  filePathOrBuffer: string | Buffer,
  opts: ExtractionOptions & { client?: MessagesClient } = {},
): Promise<ExtractionResult> {
  const parsed = await parsePdf(filePathOrBuffer);
  return extractFromPages(parsed.pages, {
    ...opts,
    rawText: parsed.text,
    pageCount: parsed.numPages,
  });
}

/**
 * Run extraction against an already-parsed page map. Validates the model output
 * with zod and retries once with a corrective prompt if the first reply is
 * structurally invalid.
 */
export async function extractFromPages(
  pages: PdfPage[],
  opts: ExtractionOptions & {
    client?: MessagesClient;
    rawText?: string;
    pageCount?: number;
  } = {},
): Promise<ExtractionResult> {
  const client = opts.client ?? getClient();
  const model = opts.model ?? DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const pageCount = opts.pageCount ?? pages.length;
  const rawText = opts.rawText ?? pages.map((p) => p.text).join("\n\n");

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: extractionUserPrompt(pages) },
  ];

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages,
    });
    const raw = textOf(response);
    const result = parseExtractionResponse(raw, pageCount);
    if (result.ok) {
      return {
        ...result.value,
        rawTextPreview: rawText.slice(0, 2000),
        pageCount,
      };
    }
    lastError = result.error;
    // Feed the bad reply back and ask for a correction.
    messages.push({ role: "assistant", content: raw });
    messages.push({ role: "user", content: extractionRetryPrompt(result.error) });
  }

  throw new Error(`Extraction failed after retry: ${lastError}`);
}
