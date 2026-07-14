import { describe, it, expect } from "vitest";
import {
  extractionUserPrompt,
  extractionRetryPrompt,
  EXTRACTION_SYSTEM_PROMPT,
} from "../src/prompts/extraction";
import { assemblePages } from "../src/extraction/pdf";
import { ITB_SAMPLE_PAGES } from "./fixtures/itb-sample";

describe("extractionUserPrompt", () => {
  const pages = assemblePages(ITB_SAMPLE_PAGES);
  const prompt = extractionUserPrompt(pages);

  it("anchors each page with a numbered marker", () => {
    expect(prompt).toContain("=== PAGE 1 ===");
    expect(prompt).toContain("=== PAGE 2 ===");
    expect(prompt).toContain("=== PAGE 3 ===");
  });

  it("includes the page count", () => {
    expect(prompt).toContain("3 pages");
  });

  it("includes the document content", () => {
    expect(prompt).toContain("Northside Elementary");
    expect(prompt).toContain("Davis-Bacon");
  });

  it("caps very long pages", () => {
    const huge = assemblePages(["x".repeat(20000)]);
    const p = extractionUserPrompt(huge);
    // 6000 char cap plus prompt scaffolding — nowhere near 20k
    expect(p.length).toBeLessThan(9000);
  });

  it("uses singular 'page' for a one-page document", () => {
    const p = extractionUserPrompt(assemblePages(["only one"]));
    expect(p).toContain("1 page)");
  });
});

describe("EXTRACTION_SYSTEM_PROMPT", () => {
  it("instructs conservative, page-anchored extraction", () => {
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/conservative/i);
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/source page/i);
  });
});

describe("extractionRetryPrompt", () => {
  it("embeds the validation error", () => {
    expect(extractionRetryPrompt("scope: expected array")).toContain("scope: expected array");
  });
});
