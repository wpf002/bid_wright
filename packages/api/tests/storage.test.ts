import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { TEST_DATABASE_URL } from "./helpers/db";

// These tests are pure, but they import the uploads route, which pulls in the
// db client — and that reads DATABASE_URL at module load. Without this the
// suite passes or fails on whether the shell happens to export it.
process.env.DATABASE_URL ??= TEST_DATABASE_URL;

let tmp: string;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "bw-storage-"));
  process.env.BIDWRIGHT_ROOT = tmp;
  process.env.UPLOAD_DIR = "uploads";
});

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("looksLikePdf", () => {
  it("accepts real PDF magic bytes", async () => {
    const { looksLikePdf } = await import("../src/routes/uploads");
    expect(looksLikePdf(Buffer.from("%PDF-1.4\n..."))).toBe(true);
  });

  it("rejects a renamed non-PDF, so we don't burn a model call on it", async () => {
    const { looksLikePdf } = await import("../src/routes/uploads");
    expect(looksLikePdf(Buffer.from("PK\x03\x04 docx payload"))).toBe(false);
    expect(looksLikePdf(Buffer.from("\x89PNG\r\n"))).toBe(false);
    expect(looksLikePdf(Buffer.from("hello"))).toBe(false);
    expect(looksLikePdf(Buffer.alloc(0))).toBe(false);
  });
});

describe("parseDeadline", () => {
  it("parses a real date string", async () => {
    const { parseDeadline } = await import("../src/routes/uploads");
    expect(parseDeadline("August 12, 2026")?.getUTCFullYear()).toBe(2026);
  });

  it("returns null rather than an Invalid Date reaching a timestamp column", async () => {
    const { parseDeadline } = await import("../src/routes/uploads");
    expect(parseDeadline("see section 3 of the front matter")).toBeNull();
    expect(parseDeadline(null)).toBeNull();
    expect(parseDeadline("")).toBeNull();
  });
});

describe("file storage", () => {
  it("round-trips a PDF through save/read", async () => {
    const { savePdf, readPdf, newStorageKey, pdfExists } = await import("../src/storage/files");
    const key = newStorageKey();
    const data = Buffer.from("%PDF-1.4 hello");
    await savePdf(key, data);
    expect(await pdfExists(key)).toBe(true);
    expect((await readPdf(key)).toString()).toBe("%PDF-1.4 hello");
  });

  it("generates unique, opaque keys (never user filenames)", async () => {
    const { newStorageKey } = await import("../src/storage/files");
    const keys = new Set(Array.from({ length: 50 }, () => newStorageKey()));
    expect(keys.size).toBe(50);
    for (const k of keys) expect(k).toMatch(/^[0-9a-f-]{36}\.pdf$/);
  });

  it("refuses path traversal outside the upload dir", async () => {
    const { resolveKey } = await import("../src/storage/files");
    expect(() => resolveKey("../../../../etc/passwd")).toThrow(/Invalid storage key/);
    expect(() => resolveKey("/etc/passwd")).toThrow(/Invalid storage key/);
    expect(() => resolveKey("../secrets.pdf")).toThrow(/Invalid storage key/);
  });

  it("allows a normal key", async () => {
    const { resolveKey } = await import("../src/storage/files");
    expect(() => resolveKey("abc-123.pdf")).not.toThrow();
  });

  it("reports a missing file rather than throwing", async () => {
    const { pdfExists } = await import("../src/storage/files");
    expect(await pdfExists("does-not-exist.pdf")).toBe(false);
  });

  it("delete is idempotent", async () => {
    const { deletePdf, savePdf, pdfExists, newStorageKey } = await import("../src/storage/files");
    const key = newStorageKey();
    await savePdf(key, Buffer.from("%PDF-1.4"));
    await deletePdf(key);
    expect(await pdfExists(key)).toBe(false);
    await expect(deletePdf(key)).resolves.toBeUndefined();
  });
});
