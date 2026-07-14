import pdfParse from "pdf-parse";
import fs from "node:fs/promises";

/** One page of an ITB, with char offsets into the full concatenated text (for provenance). */
export interface PdfPage {
  pageNumber: number; // 1-indexed
  text: string;
  charStart: number; // inclusive offset into ParsedPdf.text
  charEnd: number; // exclusive offset into ParsedPdf.text
}

export interface ParsedPdf {
  text: string;
  numPages: number;
  info: Record<string, unknown>;
  pages: PdfPage[];
}

const PAGE_SEPARATOR = "\n\n";

/**
 * Turn a list of per-page text blocks into PdfPage records with contiguous
 * char offsets. Pure and deterministic so it can be unit-tested without a real
 * PDF. Offsets assume pages are joined by PAGE_SEPARATOR.
 */
export function assemblePages(pageTexts: string[]): PdfPage[] {
  const pages: PdfPage[] = [];
  let cursor = 0;
  pageTexts.forEach((raw, i) => {
    const text = raw.trim();
    const charStart = cursor;
    const charEnd = charStart + text.length;
    pages.push({ pageNumber: i + 1, text, charStart, charEnd });
    cursor = charEnd + PAGE_SEPARATOR.length;
  });
  return pages;
}

/** Join assembled pages back into the canonical full text. */
export function pagesToText(pages: PdfPage[]): string {
  return pages.map((p) => p.text).join(PAGE_SEPARATOR);
}

/**
 * Reconstruct readable text from a pdf.js text-content object, inserting line
 * breaks when the vertical position of glyphs changes. pdf-parse hands us this
 * object per page via the `pagerender` hook, which is far more reliable for
 * page boundaries than splitting the merged output on form-feeds.
 */
interface TextItem {
  str: string;
  transform?: number[];
  hasEOL?: boolean;
}
interface TextContent {
  items: TextItem[];
}

export function renderTextContent(tc: TextContent): string {
  let out = "";
  let lastY: number | null = null;
  for (const item of tc.items) {
    const y = item.transform?.[5];
    if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 1) {
      out += "\n";
    }
    out += item.str;
    if (item.hasEOL) out += "\n";
    else out += " ";
    if (y !== undefined) lastY = y;
  }
  return out
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function parsePdf(filePathOrBuffer: string | Buffer): Promise<ParsedPdf> {
  const buffer =
    typeof filePathOrBuffer === "string"
      ? await fs.readFile(filePathOrBuffer)
      : filePathOrBuffer;

  const pageTexts: string[] = [];
  const data = await pdfParse(buffer, {
    // Collect text per page. Returned string is what pdf-parse concatenates
    // into data.text; the side-effect push is what gives us the page map.
    pagerender: async (pageData: {
      getTextContent: (opts?: unknown) => Promise<TextContent>;
    }) => {
      const tc = await pageData.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });
      const text = renderTextContent(tc);
      pageTexts.push(text);
      return text + PAGE_SEPARATOR;
    },
  });

  const pages = assemblePages(pageTexts.length > 0 ? pageTexts : [data.text]);
  return {
    text: pagesToText(pages),
    numPages: data.numpages || pages.length,
    info: (data.info ?? {}) as Record<string, unknown>,
    pages,
  };
}
