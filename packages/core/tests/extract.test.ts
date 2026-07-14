import { describe, it, expect } from "vitest";
import {
  extractJsonBlock,
  parseExtractionResponse,
  extractFromPages,
  type MessagesClient,
} from "../src/extraction/extract";
import { assemblePages } from "../src/extraction/pdf";
import { ITB_SAMPLE_PAGES, VALID_EXTRACTION_JSON } from "./fixtures/itb-sample";

/** Build a fake Anthropic client that returns the given text replies in order. */
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

describe("extractJsonBlock", () => {
  it("strips ```json fences", () => {
    expect(extractJsonBlock('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("strips bare ``` fences", () => {
    expect(extractJsonBlock('```\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("pulls the JSON object out of surrounding prose", () => {
    expect(extractJsonBlock('Here you go: {"a":1} hope that helps')).toBe('{"a":1}');
  });
  it("leaves clean JSON untouched", () => {
    expect(extractJsonBlock('{"a":1}')).toBe('{"a":1}');
  });
});

describe("parseExtractionResponse", () => {
  it("parses and validates a fenced valid reply", () => {
    const res = parseExtractionResponse("```json\n" + VALID_EXTRACTION_JSON + "\n```", 3);
    expect(res.ok).toBe(true);
  });
  it("reports a JSON parse failure", () => {
    const res = parseExtractionResponse("{ not json", 3);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/JSON parse failed/);
  });
  it("reports a schema failure for wrong shape", () => {
    const res = parseExtractionResponse('{"scope": 5}', 3);
    expect(res.ok).toBe(false);
  });
});

describe("extractFromPages", () => {
  const pages = assemblePages(ITB_SAMPLE_PAGES);

  it("returns a validated ExtractionResult on the happy path", async () => {
    const client = mockClient([VALID_EXTRACTION_JSON]);
    const result = await extractFromPages(pages, { client, pageCount: 3 });
    expect(client.calls).toBe(1);
    expect(result.scope).toHaveLength(6);
    expect(result.pageCount).toBe(3);
    expect(result.rawTextPreview.length).toBeGreaterThan(0);
    expect(result.primaryTrade).toBe("electrical");
  });

  it("every scope item carries a sourcePage", async () => {
    const client = mockClient([VALID_EXTRACTION_JSON]);
    const result = await extractFromPages(pages, { client, pageCount: 3 });
    for (const item of result.scope) {
      expect(item.sourcePage).not.toBeNull();
    }
  });

  it("retries once with a correction and then succeeds", async () => {
    const client = mockClient(["garbage not json", VALID_EXTRACTION_JSON]);
    const result = await extractFromPages(pages, { client, pageCount: 3 });
    expect(client.calls).toBe(2);
    expect(result.scope.length).toBeGreaterThan(0);
  });

  it("throws after the retry also fails", async () => {
    const client = mockClient(["nope", "still nope"]);
    await expect(extractFromPages(pages, { client, pageCount: 3 })).rejects.toThrow(
      /Extraction failed after retry/,
    );
    expect(client.calls).toBe(2);
  });
});
