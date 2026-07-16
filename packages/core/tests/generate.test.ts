import { describe, it, expect } from "vitest";
import { isIntegerCents } from "@bidwright/shared";
import type { ExtractionResult } from "@bidwright/shared";
import {
  parseGenerationResponse,
  draftToLineItems,
  draftToBidResponse,
  generateBidResponse,
} from "../src/generation/generate";
import { validateGenerationDraft } from "../src/generation/schema";
import { generationUserPrompt, GENERATION_SYSTEM_PROMPT, historyBlock } from "../src/prompts/generation";
import type { MessagesClient } from "../src/extraction/extract";
import { VALID_EXTRACTION_JSON } from "./fixtures/itb-sample";

const extraction: ExtractionResult = {
  ...JSON.parse(VALID_EXTRACTION_JSON),
  rawTextPreview: "preview",
  pageCount: 3,
};

/** A draft that satisfies the Phase 2 exit criteria. */
const VALID_DRAFT = JSON.stringify({
  lineItems: [
    { description: "Demolish existing lighting fixtures", quantity: 240, unit: "EA", notes: null, sourcePage: 2 },
    { description: "Furnish and install LED 2x4 troffers", quantity: 260, unit: "EA", notes: null, sourcePage: 2 },
    { description: "Install 300 kVA transformer", quantity: 1, unit: "EA", notes: "Verify pad", sourcePage: 2 },
    { description: "Install EMT conduit", quantity: 3500, unit: "LF", notes: null, sourcePage: 2 },
    { description: "Pull copper branch wiring", quantity: 12000, unit: "LF", notes: null, sourcePage: 2 },
    { description: "Fire alarm devices", quantity: 45, unit: "EA", notes: "Quantity approximate — verify", sourcePage: 2 },
  ],
  assumptions: ["Work during normal hours.", "Temp power by GC.", "Site is dry."],
  clarifications: ["Confirm shutdown windows.", "Is the fixture package owner-furnished?", "Confirm retainage."],
  exclusions: ["Permits.", "Bonds.", "Firestopping.", "Cutting and patching.", "Final cleaning.", "Low voltage."],
  suggestedOverheadPercent: 10,
  suggestedProfitPercent: 8,
  suggestedValidityDays: 30,
});

function mockClient(replies: string[]): MessagesClient & { calls: number } {
  let i = 0;
  const client = {
    calls: 0,
    messages: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: async (): Promise<any> => {
        const text = replies[Math.min(i, replies.length - 1)];
        i++;
        client.calls++;
        return { content: [{ type: "text", text }] };
      },
    },
  };
  return client;
}

describe("validateGenerationDraft", () => {
  it("accepts a well-formed draft", () => {
    const res = validateGenerationDraft(JSON.parse(VALID_DRAFT));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.lineItems).toHaveLength(6);
  });

  it("defaults a missing unit to LS", () => {
    const res = validateGenerationDraft({
      lineItems: [{ description: "Vague scope", quantity: 1, unit: "" }],
      assumptions: [], clarifications: [], exclusions: [],
      suggestedOverheadPercent: 10, suggestedProfitPercent: 10, suggestedValidityDays: 30,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.lineItems[0].unit).toBe("LS");
  });

  it("drops line items with no description", () => {
    const res = validateGenerationDraft({
      lineItems: [{ description: "Good", quantity: 1, unit: "EA" }, { quantity: 5, unit: "EA" }],
      assumptions: [], clarifications: [], exclusions: [],
      suggestedOverheadPercent: 10, suggestedProfitPercent: 10, suggestedValidityDays: 30,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.lineItems).toHaveLength(1);
  });

  it("clamps out-of-range percents", () => {
    const res = validateGenerationDraft({
      lineItems: [], assumptions: [], clarifications: [], exclusions: [],
      suggestedOverheadPercent: 900, suggestedProfitPercent: -5, suggestedValidityDays: 0,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.suggestedOverheadPercent).toBe(100);
    expect(res.value.suggestedProfitPercent).toBe(0);
    expect(res.value.suggestedValidityDays).toBe(30); // 0 is invalid -> fallback
  });

  it("rejects a structurally broken draft", () => {
    expect(validateGenerationDraft({ lineItems: "nope" }).ok).toBe(false);
    expect(validateGenerationDraft(null).ok).toBe(false);
  });
});

describe("draftToLineItems", () => {
  it("forces zero pricing and null confidence (the estimator prices the bid)", () => {
    const res = validateGenerationDraft(JSON.parse(VALID_DRAFT));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    for (const li of draftToLineItems(res.value)) {
      expect(li.unitCostCents).toBe(0);
      expect(li.totalCostCents).toBe(0);
      expect(li.confidence).toBeNull();
    }
  });

  it("ignores any pricing the model tries to invent", () => {
    const res = validateGenerationDraft({
      lineItems: [{ description: "Sneaky", quantity: 1, unit: "EA", unitCostCents: 999999, totalCostCents: 999999 }],
      assumptions: [], clarifications: [], exclusions: [],
      suggestedOverheadPercent: 10, suggestedProfitPercent: 10, suggestedValidityDays: 30,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const items = draftToLineItems(res.value);
    expect(items[0].unitCostCents).toBe(0);
    expect(items[0].totalCostCents).toBe(0);
  });

  it("gives every line item a unique id and carries sourcePage through", () => {
    const res = validateGenerationDraft(JSON.parse(VALID_DRAFT));
    if (!res.ok) return;
    const items = draftToLineItems(res.value);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(items[0].sourcePage).toBe(2);
  });
});

describe("draftToBidResponse", () => {
  const res = validateGenerationDraft(JSON.parse(VALID_DRAFT));
  const draft = res.ok ? res.value : null;

  it("produces a valid draft BidResponse", () => {
    expect(draft).not.toBeNull();
    if (!draft) return;
    const bid = draftToBidResponse(draft, extraction, "itb.pdf");
    expect(bid.status).toBe("draft");
    expect(bid.itbFileName).toBe("itb.pdf");
    expect(bid.extraction).toBe(extraction);
    expect(bid.validityDays).toBe(30);
    expect(bid.overheadPercent).toBe(10);
    expect(bid.profitPercent).toBe(8);
  });

  it("all money fields are integer cents", () => {
    if (!draft) return;
    const bid = draftToBidResponse(draft, extraction, "itb.pdf");
    expect(isIntegerCents(bid.subtotalCents)).toBe(true);
    expect(isIntegerCents(bid.totalCents)).toBe(true);
    for (const li of bid.lineItems) {
      expect(isIntegerCents(li.unitCostCents)).toBe(true);
      expect(isIntegerCents(li.totalCostCents)).toBe(true);
    }
  });

  it("serializes to JSON cleanly (the -o bid.json path)", () => {
    if (!draft) return;
    const bid = draftToBidResponse(draft, extraction, "itb.pdf");
    const round = JSON.parse(JSON.stringify(bid));
    expect(round.lineItems).toHaveLength(6);
    expect(round.subtotalCents).toBe(0);
  });
});

describe("generateBidResponse", () => {
  it("meets the Phase 2 exit criteria: >=5 line items, >=3 assumptions, >=3 clarifications, >=5 exclusions", async () => {
    const client = mockClient([VALID_DRAFT]);
    const bid = await generateBidResponse(extraction, "itb.pdf", { client });
    expect(bid.lineItems.length).toBeGreaterThanOrEqual(5);
    expect(bid.assumptions.length).toBeGreaterThanOrEqual(3);
    expect(bid.clarifications.length).toBeGreaterThanOrEqual(3);
    expect(bid.exclusions.length).toBeGreaterThanOrEqual(5);
  });

  it("parses a fenced reply", async () => {
    const client = mockClient(["```json\n" + VALID_DRAFT + "\n```"]);
    const bid = await generateBidResponse(extraction, "itb.pdf", { client });
    expect(bid.lineItems).toHaveLength(6);
    expect(client.calls).toBe(1);
  });

  it("retries once then succeeds", async () => {
    const client = mockClient(["not json at all", VALID_DRAFT]);
    const bid = await generateBidResponse(extraction, "itb.pdf", { client });
    expect(client.calls).toBe(2);
    expect(bid.lineItems).toHaveLength(6);
  });

  it("throws after the retry also fails", async () => {
    const client = mockClient(["bad", "still bad"]);
    await expect(generateBidResponse(extraction, "itb.pdf", { client })).rejects.toThrow(
      /Bid generation failed after retry/,
    );
    expect(client.calls).toBe(2);
  });
});

describe("parseGenerationResponse", () => {
  it("reports a JSON parse failure", () => {
    const res = parseGenerationResponse("{ broken");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/JSON parse failed/);
  });
});

describe("generation prompt v2", () => {
  it("is trade-aware and injects candidate clauses for the trade", () => {
    const prompt = generationUserPrompt(extraction);
    expect(prompt).toContain("Electrical");
    // an electrical-specific exclusion candidate
    expect(prompt).toContain("Utility company fees");
    // a general assumption candidate
    expect(prompt).toContain("normal business hours");
  });

  it("does not leak another trade's candidates", () => {
    const prompt = generationUserPrompt(extraction);
    expect(prompt).not.toContain("roof deck is structurally sound");
  });

  it("respects an explicit trade override", () => {
    const prompt = generationUserPrompt(extraction, "roofing");
    expect(prompt).toContain("Roofing");
    expect(prompt).toContain("existing roof deck is structurally sound");
  });

  it("forbids pricing in the system prompt", () => {
    expect(GENERATION_SYSTEM_PROMPT).toMatch(/NEVER include pricing/);
  });

  it("asks for JSON with no pricing fields", () => {
    const prompt = generationUserPrompt(extraction);
    expect(prompt).toContain("no pricing fields");
    expect(prompt).not.toContain("unitCostCents");
  });
});

describe("history-enriched generation prompt", () => {
  const past = [
    "Install EMT conduit for branch circuits",
    "Pull copper branch wiring, THHN #12 AWG",
  ];

  it("includes the estimator's past wording so history can match", () => {
    const prompt = generationUserPrompt(extraction, "electrical", past);
    expect(prompt).toContain("Install EMT conduit for branch circuits");
    expect(prompt).toMatch(/reuse that wording verbatim/i);
  });

  it("omits the block entirely for a user with no history", () => {
    const prompt = generationUserPrompt(extraction, "electrical", []);
    expect(prompt).not.toMatch(/HOW THIS SUBCONTRACTOR USUALLY DESCRIBES/);
  });

  it("tells the model not to invent scope from history", () => {
    const prompt = generationUserPrompt(extraction, "electrical", past);
    expect(prompt).toMatch(/only describe work this ITB actually calls for/i);
  });

  it("never puts prices in the prompt — the model must not originate money", () => {
    const block = historyBlock(past);
    expect(block).not.toMatch(/\$|cents|unitCost/i);
  });

  it("caps the history block so a long history can't crowd out the ITB", () => {
    const many = Array.from({ length: 200 }, (_, i) => `Historical work item number ${i}`);
    const block = historyBlock(many);
    expect(block).toContain("Historical work item number 39");
    expect(block).not.toContain("Historical work item number 40");
  });
});
