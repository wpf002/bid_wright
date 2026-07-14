import Anthropic from "@anthropic-ai/sdk";
import type { Trade } from "@bidwright/shared";
import { TRADE_SLUGS, normalizeTrade } from "./schema";
import type { MessagesClient } from "./extract";

const CLASSIFIER_MODEL = "claude-haiku-4-5-20251001";

let defaultClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!defaultClient) defaultClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return defaultClient;
}

/** Coerce the model's free-text reply into a valid trade slug. */
export function parseTradeReply(reply: string): Trade {
  // The model may add punctuation or a sentence; take the first token-ish run.
  const firstLine = reply.trim().split(/[\n.]/)[0] ?? "";
  return normalizeTrade(firstLine.trim());
}

export async function classifyTrade(
  text: string,
  opts: { client?: MessagesClient } = {},
): Promise<Trade> {
  const client = opts.client ?? getClient();
  const res = await client.messages.create({
    model: CLASSIFIER_MODEL,
    max_tokens: 20,
    messages: [
      {
        role: "user",
        content: `Classify this construction scope text into ONE trade from this list: ${TRADE_SLUGS.join(", ")}.
Reply with only the trade slug, nothing else.

Text: "${text.slice(0, 500)}"`,
      },
    ],
  });

  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return "other";
  return parseTradeReply(block.text);
}
