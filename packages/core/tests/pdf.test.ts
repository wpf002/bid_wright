import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { assemblePages, pagesToText, renderTextContent, parsePdf } from "../src/extraction/pdf";
import { ITB_SAMPLE_PAGES } from "./fixtures/itb-sample";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TWO_PAGE_PDF = path.join(HERE, "fixtures", "two-page.pdf");

describe("assemblePages", () => {
  it("assigns 1-indexed page numbers", () => {
    const pages = assemblePages(["a", "b", "c"]);
    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
  });

  it("computes contiguous, non-overlapping char offsets", () => {
    const pages = assemblePages(["hello", "world!!"]);
    expect(pages[0]).toMatchObject({ charStart: 0, charEnd: 5 });
    // second page starts after page 1 text (5) + separator ("\n\n" = 2)
    expect(pages[1].charStart).toBe(7);
    expect(pages[1].charEnd).toBe(7 + "world!!".length);
  });

  it("trims each page's text", () => {
    const pages = assemblePages(["  padded  "]);
    expect(pages[0].text).toBe("padded");
    expect(pages[0].charEnd).toBe("padded".length);
  });

  it("round-trips through pagesToText so offsets line up with the joined text", () => {
    const pages = assemblePages(ITB_SAMPLE_PAGES);
    const full = pagesToText(pages);
    for (const p of pages) {
      expect(full.slice(p.charStart, p.charEnd)).toBe(p.text);
    }
  });

  it("handles an empty page list", () => {
    expect(assemblePages([])).toEqual([]);
  });
});

describe("renderTextContent", () => {
  it("breaks lines when vertical position changes and joins glyphs on the same line", () => {
    const tc = {
      items: [
        { str: "Line", transform: [1, 0, 0, 1, 0, 100] },
        { str: "one", transform: [1, 0, 0, 1, 20, 100] },
        { str: "Line", transform: [1, 0, 0, 1, 0, 80] },
        { str: "two", transform: [1, 0, 0, 1, 20, 80] },
      ],
    };
    expect(renderTextContent(tc)).toBe("Line one\nLine two");
  });

  it("collapses runs of whitespace", () => {
    const tc = { items: [{ str: "a   b" }, { str: "  c" }] };
    expect(renderTextContent(tc)).toBe("a b c");
  });

  it("honors explicit end-of-line markers", () => {
    const tc = { items: [{ str: "top", hasEOL: true }, { str: "bottom" }] };
    expect(renderTextContent(tc)).toBe("top\nbottom");
  });
});

describe("parsePdf (real 2-page PDF)", () => {
  it("maps each page to its own text with contiguous offsets", async () => {
    const parsed = await parsePdf(TWO_PAGE_PDF);
    expect(parsed.numPages).toBe(2);
    expect(parsed.pages).toHaveLength(2);
    expect(parsed.pages[0].text).toContain("PAGE ONE ALPHA");
    expect(parsed.pages[1].text).toContain("PAGE TWO BRAVO");
    // page 1 content must not bleed into page 2
    expect(parsed.pages[0].text).not.toContain("BRAVO");
  });

  it("char offsets round-trip against the full text", async () => {
    const parsed = await parsePdf(TWO_PAGE_PDF);
    for (const p of parsed.pages) {
      expect(parsed.text.slice(p.charStart, p.charEnd)).toBe(p.text);
    }
  });

  it("accepts a Buffer as well as a path", async () => {
    const fs = await import("node:fs/promises");
    const buf = await fs.readFile(TWO_PAGE_PDF);
    const parsed = await parsePdf(buf);
    expect(parsed.pages).toHaveLength(2);
  });
});
