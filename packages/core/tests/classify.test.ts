import { describe, it, expect } from "vitest";
import { parseTradeReply, classifyTrade } from "../src/extraction/classify";
import type { MessagesClient } from "../src/extraction/extract";

function mockClient(text: string): MessagesClient {
  return {
    messages: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: async (): Promise<any> => ({ content: [{ type: "text", text }] }),
    },
  };
}

describe("parseTradeReply", () => {
  it("accepts a clean slug", () => {
    expect(parseTradeReply("electrical")).toBe("electrical");
  });
  it("handles a slug with trailing punctuation or a sentence", () => {
    expect(parseTradeReply("plumbing.")).toBe("plumbing");
    expect(parseTradeReply("hvac\nThat is my answer")).toBe("hvac");
  });
  it("normalizes casing and spacing", () => {
    expect(parseTradeReply("Fire Protection")).toBe("fire_protection");
  });
  it("falls back to other for nonsense", () => {
    expect(parseTradeReply("I am not sure")).toBe("other");
  });
});

describe("classifyTrade", () => {
  it("returns the model's classified trade", async () => {
    const trade = await classifyTrade("Install 200A panel and branch circuits", {
      client: mockClient("electrical"),
    });
    expect(trade).toBe("electrical");
  });
  it("returns other when the reply is empty", async () => {
    const trade = await classifyTrade("ambiguous text", { client: mockClient("") });
    expect(trade).toBe("other");
  });
});
