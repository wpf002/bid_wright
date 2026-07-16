import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Local filesystem storage for uploaded ITB PDFs.
 *
 * The editor's click-through provenance needs the original PDF, so we keep it
 * rather than discarding the buffer after extraction. Dev/Railway use a disk
 * path; swapping in object storage later means reimplementing this module only.
 */

/**
 * Resolved lazily: loadEnv() sets BIDWRIGHT_ROOT, and the API's cwd is
 * packages/api, so a bare cwd default would scatter uploads per-package.
 */
export function uploadDir(): string {
  const root = process.env.BIDWRIGHT_ROOT ?? process.cwd();
  const configured = process.env.UPLOAD_DIR;
  return configured ? path.resolve(root, configured) : path.join(root, "uploads");
}

/**
 * Storage keys are opaque and generated, never derived from user filenames —
 * a filename is attacker-controlled and would be a path-traversal vector.
 */
export function newStorageKey(ext = "pdf"): string {
  return `${randomUUID()}.${ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin"}`;
}

export async function saveFile(key: string, data: Buffer): Promise<string> {
  await fs.mkdir(uploadDir(), { recursive: true });
  const full = resolveKey(key);
  await fs.writeFile(full, data);
  return full;
}

/** Kept as the ITB-facing name; letterheads use saveFile directly. */
export const savePdf = saveFile;

/**
 * Resolve a storage key to an absolute path, refusing anything that escapes
 * the upload dir. Keys come from our own DB, but a path-traversal check here
 * is cheap insurance against a malformed or tampered row.
 */
export function resolveKey(key: string): string {
  const base = path.resolve(uploadDir());
  const full = path.resolve(base, key);
  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return full;
}

export async function readFile(key: string): Promise<Buffer> {
  return fs.readFile(resolveKey(key));
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    await fs.access(resolveKey(key));
    return true;
  } catch {
    return false;
  }
}

export async function deleteFile(key: string): Promise<void> {
  await fs.rm(resolveKey(key), { force: true });
}

export const readPdf = readFile;
export const pdfExists = fileExists;
export const deletePdf = deleteFile;

/**
 * Image types we accept for a letterhead, by magic bytes. Trusting the declared
 * content-type would let an attacker store arbitrary bytes we later serve back
 * with an image content-type.
 */
export function sniffImageType(buffer: Buffer): "image/png" | "image/jpeg" | null {
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}
