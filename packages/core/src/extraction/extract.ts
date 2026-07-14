import Anthropic from "@anthropic-ai/sdk";
import type { ExtractionResult } from "@bidwright/shared";
import { parsePdf } from "./pdf";
import { EXTRACTION_SYSTEM_PROMPT, extractionUserPrompt } from "../prompts/extraction";
import type { ExtractionOptions } from "../types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DEFAULT_MODEL = "claude-opus-4-7";

export async function extractFromPdf(
  filePathOrBuffer: string | Buffer,
  opts: ExtractionOptions = {},
): Promise<ExtractionResult> {
  const parsed = await parsePdf(filePathOrBuffer);

  const response = await client.messages.create({
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: extractionUserPrompt(parsed.pages) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const cleaned = textBlock.text.replace(/```json\n?|```/g, "").trim();
  let extraction: Omit<ExtractionResult, "rawTextPreview" | "pageCount">;
  try {
    extraction = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse extraction JSON: ${err}\nRaw: ${cleaned.slice(0, 500)}`);
  }

  return {
    ...extraction,
    rawTextPreview: parsed.text.slice(0, 2000),
    pageCount: parsed.numPages,
  };
}
