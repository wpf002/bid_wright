import Anthropic from "@anthropic-ai/sdk";
import type { Trade } from "@bidwright/shared";

const TRADES: Trade[] = [
  "electrical", "plumbing", "hvac", "drywall", "framing", "concrete",
  "roofing", "flooring", "painting", "masonry", "demolition", "earthwork",
  "steel", "glazing", "insulation", "fire_protection", "low_voltage",
  "landscaping", "asphalt", "other",
];

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function classifyTrade(text: string): Promise<Trade> {
  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 20,
    messages: [{
      role: "user",
      content: `Classify this construction scope text into ONE trade from this list: ${TRADES.join(", ")}.
Reply with only the trade slug, nothing else.

Text: "${text.slice(0, 500)}"`,
    }],
  });

  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return "other";
  const trade = block.text.trim().toLowerCase() as Trade;
  return TRADES.includes(trade) ? trade : "other";
}
