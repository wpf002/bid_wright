/**
 * The sweep's safety policy — deliberately free of database and filesystem
 * imports, so the decision that protects a user's documents can be tested
 * without staging a database into a particular state.
 */

/**
 * Below this, an all-orphan directory is unremarkable — a dev box with a couple
 * of stray files. At or above it, "not one file here is referenced" is far more
 * likely to mean we're looking at the wrong database or the wrong directory
 * than that every document is garbage.
 */
export const EMPTY_DB_SUSPICION_THRESHOLD = 5;

/**
 * Should the sweep refuse to run?
 *
 * Keys off how many files on disk are actually referenced, rather than how many
 * rows the database has, because that catches both ways this goes wrong:
 *
 *   - wrong (or un-migrated) DATABASE_URL: no rows, so nothing matches;
 *   - wrong UPLOAD_DIR: rows exist, but none of them name the files in front of
 *     us — which may not even be our files.
 *
 * Either way the observable state is identical: a directory of documents that
 * nothing claims. Deleting on that evidence is how you lose everything.
 *
 * When a human runs the sweep, the dry-run list is the safeguard: they see
 * "500 orphans" and stop. On a timer, nobody is reading. This is the backstop
 * that still works at 3am.
 *
 * The cost of being wrong is asymmetric: refusing wastes a cycle and logs an
 * error, deleting is permanent. So a legitimately all-orphan directory refuses
 * too, and a human passes force once.
 */
export function shouldRefuseSweep(args: {
  /** Files on disk that an upload or logo row actually references. */
  referencedOnDiskCount: number;
  /** Files in the directory. */
  fileCount: number;
  force?: boolean;
}): boolean {
  if (args.force) return false;
  return args.referencedOnDiskCount === 0 && args.fileCount >= EMPTY_DB_SUSPICION_THRESHOLD;
}
