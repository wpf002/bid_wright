import fs from "node:fs/promises";
import path from "node:path";
import { db, uploads, bids } from "@bidwright/db";
import { eq, and, lt, inArray } from "drizzle-orm";
import { uploadDir, deleteFile } from "./files";
import { shouldRefuseSweep } from "./sweep-policy";

/**
 * What happens to stored PDFs over time.
 *
 * Three separate problems, deliberately kept apart because they carry very
 * different risk:
 *
 *   1. Deleting a bid left its PDFs on disk forever. A plain bug — the DB rows
 *      cascade, the bytes never did. Fixed by storageKeysForBid + deleteKeys,
 *      called from the delete route.
 *
 *   2. Files already leaked, plus any that escape a future crash between the
 *      row delete and the unlink. sweepOrphans is the backstop.
 *
 *   3. Growth over the life of an account. This is the one that deletes data a
 *      user might still want, so the policy is deliberately narrow — see
 *      purgeExpiredSupporting.
 *
 * The ordering rule everywhere: delete the DB row first, then the bytes. The
 * reverse leaves rows pointing at missing files, which breaks the editor's
 * provenance pane. An orphaned byte is a disk cost; an orphaned row is a broken
 * page, and the sweeper cleans the former.
 */

export { shouldRefuseSweep, EMPTY_DB_SUSPICION_THRESHOLD } from "./sweep-policy";

/** Files younger than this are never swept — an upload may be mid-flight. */
const ORPHAN_GRACE_MS = 60 * 60 * 1000;

/**
 * Supporting files are convenience copies: we never extract from them, and the
 * originals are still in the user's mailbox. The primary is different — it's
 * the document the bid was built from, it backs the provenance pane, and for a
 * won job it's a business record. So the primary is never purged on a timer;
 * only supporting material ages out.
 */
export const DEFAULT_SUPPORTING_RETENTION_DAYS = 180;

export interface SweepResult {
  /** Storage keys removed (or that would be, when dryRun). */
  removed: string[];
  bytes: number;
  dryRun: boolean;
  /**
   * Set when the sweep refused to run. The caller should treat this as an
   * error worth surfacing, not a quiet no-op.
   */
  aborted?: string;
}

/**
 * The storage keys for one bid, scoped to its owner.
 *
 * Must be called BEFORE deleting the bid: the cascade takes the upload rows
 * with it, and with them the only record of which bytes to remove.
 *
 * The owner join is not decoration. This function's output is fed straight to
 * unlink, so an unscoped lookup would let one user's delete request name
 * another user's bid id and take their documents with it.
 */
export async function storageKeysForBid(bidId: string, userId: string): Promise<string[]> {
  const rows = await db
    .select({ storagePath: uploads.storagePath })
    .from(uploads)
    .innerJoin(bids, eq(bids.id, uploads.bidId))
    .where(and(eq(uploads.bidId, bidId), eq(bids.userId, userId)));
  return rows.map((r) => r.storagePath);
}

/**
 * Unlink a set of storage keys, returning the ones that failed.
 *
 * Each unlink is independent — one failure must not abort the rest, and a file
 * we couldn't remove is a disk cost that sweepOrphans collects, not an error
 * worth failing a delete that has already committed.
 */
export async function deleteKeys(keys: string[]): Promise<string[]> {
  const failed: string[] = [];
  for (const key of keys) {
    try {
      await deleteFile(key);
    } catch {
      failed.push(key);
    }
  }
  return failed;
}

/**
 * Remove files on disk that no upload row references.
 *
 * Deliberately conservative. It decides what to delete by absence from the
 * database, so a wrong or un-migrated DATABASE_URL makes every document look
 * like garbage. Three things stand in the way of that:
 *
 *   - dry-run by default, so a human sees the list first;
 *   - the grace window, so a live upload isn't caught mid-write;
 *   - the empty-database check below, which is the only one of the three that
 *     still works when this runs unattended on a timer.
 */
export async function sweepOrphans(
  opts: { dryRun?: boolean; force?: boolean } = {},
): Promise<SweepResult> {
  const dryRun = opts.dryRun ?? true;
  const dir = uploadDir();

  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return { removed: [], bytes: 0, dryRun };
  }

  const referenced = new Set(
    (await db.select({ storagePath: uploads.storagePath }).from(uploads)).map((r) => r.storagePath),
  );
  // Letterheads live in the same directory and are referenced from users, not
  // uploads. Sweeping on the uploads table alone would delete every logo.
  for (const key of await referencedLogoKeys()) referenced.add(key);

  // Count what's actually claimed here, not what the database holds in total:
  // rows for a different directory prove nothing about the files in front of us.
  const referencedOnDiskCount = names.filter((n) => referenced.has(n)).length;

  // The scheduled sweep has no human reading a dry-run list, so this is its
  // only backstop against a wrong DATABASE_URL or a wrong UPLOAD_DIR.
  if (shouldRefuseSweep({ referencedOnDiskCount, fileCount: names.length, force: opts.force })) {
    return {
      removed: [],
      bytes: 0,
      dryRun,
      aborted:
        `not one of the ${names.length} files in ${dir} is referenced by an upload or logo row — ` +
        `refusing to treat them all as orphans. Check DATABASE_URL, UPLOAD_DIR, and that ` +
        `migrations have run. Pass force to override.`,
    };
  }

  const removed: string[] = [];
  let bytes = 0;
  const now = Date.now();

  for (const name of names) {
    if (referenced.has(name)) continue;

    const full = path.join(dir, name);
    let stat;
    try {
      stat = await fs.stat(full);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    // An upload writes bytes before committing its row; without this a sweep
    // racing an upload would delete a file that is about to be referenced.
    if (now - stat.mtimeMs < ORPHAN_GRACE_MS) continue;

    if (!dryRun) {
      try {
        await fs.rm(full, { force: true });
      } catch {
        continue;
      }
    }
    removed.push(name);
    bytes += stat.size;
  }

  return { removed, bytes, dryRun };
}

/** Logo keys, read lazily so this module doesn't hard-depend on the users table shape. */
async function referencedLogoKeys(): Promise<string[]> {
  const { users } = await import("@bidwright/db");
  const rows = await db.select({ key: users.logoStoragePath }).from(users);
  return rows.map((r) => r.key).filter((k): k is string => Boolean(k));
}

/**
 * Age out supporting attachments — never the primary.
 *
 * Bounds growth over an account's life without touching the document any bid
 * actually rests on. Rows go first, then bytes.
 */
export async function purgeExpiredSupporting(
  opts: { olderThanDays?: number; dryRun?: boolean } = {},
): Promise<SweepResult> {
  const days = opts.olderThanDays ?? DEFAULT_SUPPORTING_RETENTION_DAYS;
  const dryRun = opts.dryRun ?? true;
  const cutoff = new Date(Date.now() - days * 86_400_000);

  const expired = await db
    .select({ id: uploads.id, storagePath: uploads.storagePath, fileSize: uploads.fileSize })
    .from(uploads)
    .where(and(eq(uploads.isPrimary, false), lt(uploads.createdAt, cutoff)));

  if (expired.length === 0 || dryRun) {
    return {
      removed: expired.map((e) => e.storagePath),
      bytes: expired.reduce((sum, e) => sum + e.fileSize, 0),
      dryRun,
    };
  }

  await db.delete(uploads).where(inArray(uploads.id, expired.map((e) => e.id)));

  const removed: string[] = [];
  let bytes = 0;
  for (const row of expired) {
    try {
      await deleteFile(row.storagePath);
      removed.push(row.storagePath);
      bytes += row.fileSize;
    } catch {
      // Row is gone; sweepOrphans collects the bytes.
    }
  }
  return { removed, bytes, dryRun };
}
