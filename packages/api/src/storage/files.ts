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

/** Storage keys are opaque and generated, never derived from user filenames. */
export function newStorageKey(): string {
  return `${randomUUID()}.pdf`;
}

export async function savePdf(key: string, data: Buffer): Promise<string> {
  await fs.mkdir(uploadDir(), { recursive: true });
  const full = resolveKey(key);
  await fs.writeFile(full, data);
  return full;
}

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

export async function readPdf(key: string): Promise<Buffer> {
  return fs.readFile(resolveKey(key));
}

export async function pdfExists(key: string): Promise<boolean> {
  try {
    await fs.access(resolveKey(key));
    return true;
  } catch {
    return false;
  }
}

export async function deletePdf(key: string): Promise<void> {
  await fs.rm(resolveKey(key), { force: true });
}
