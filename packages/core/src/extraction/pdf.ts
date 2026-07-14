import pdfParse from "pdf-parse";
import fs from "node:fs/promises";

export interface ParsedPdf {
  text: string;
  numPages: number;
  info: Record<string, unknown>;
  pages: string[];
}

export async function parsePdf(filePathOrBuffer: string | Buffer): Promise<ParsedPdf> {
  const buffer =
    typeof filePathOrBuffer === "string"
      ? await fs.readFile(filePathOrBuffer)
      : filePathOrBuffer;

  const data = await pdfParse(buffer);
  const pages = data.text.split(/\f/).map((p) => p.trim()).filter(Boolean);
  return {
    text: data.text,
    numPages: data.numpages,
    info: data.info as Record<string, unknown>,
    pages: pages.length > 0 ? pages : [data.text],
  };
}
