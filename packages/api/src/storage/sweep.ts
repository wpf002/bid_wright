/**
 * Storage maintenance CLI.
 *
 *   npm run storage:sweep                 # report orphans, delete nothing
 *   npm run storage:sweep -- --delete     # actually remove them
 *   npm run storage:sweep -- --retention  # also age out old supporting files
 *
 * Dry-run is the default on purpose: this decides what to delete by absence
 * from the database, so pointing it at the wrong DATABASE_URL would mean
 * deleting every document. Seeing the list before it acts is the safeguard.
 */
import { loadEnv } from "../env";

loadEnv();

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--delete");
  const withRetention = args.includes("--retention");
  const force = args.includes("--force");

  const { sweepOrphans, purgeExpiredSupporting, DEFAULT_SUPPORTING_RETENTION_DAYS } = await import(
    "./retention"
  );

  const mb = (b: number) => `${(b / 1024 / 1024).toFixed(2)} MB`;

  const orphans = await sweepOrphans({ dryRun, force });
  if (orphans.aborted) {
    // Exit non-zero: this is a refusal, and a caller that scripted the sweep
    // should hear about it rather than read "0 files" as success.
    console.error(`\n⛔ Refused: ${orphans.aborted}\n`);
    process.exit(2);
  }
  console.log(
    dryRun
      ? `\n🔍 ${orphans.removed.length} orphaned file(s), ${mb(orphans.bytes)} — nothing deleted`
      : `\n🧹 Removed ${orphans.removed.length} orphaned file(s), freed ${mb(orphans.bytes)}`,
  );
  for (const name of orphans.removed.slice(0, 20)) console.log(`   ${name}`);
  if (orphans.removed.length > 20) console.log(`   … and ${orphans.removed.length - 20} more`);

  if (withRetention) {
    const purged = await purgeExpiredSupporting({ dryRun });
    console.log(
      dryRun
        ? `\n🔍 ${purged.removed.length} supporting file(s) older than ${DEFAULT_SUPPORTING_RETENTION_DAYS} days, ${mb(purged.bytes)} — nothing deleted`
        : `\n🧹 Purged ${purged.removed.length} expired supporting file(s), freed ${mb(purged.bytes)}`,
    );
  }

  if (dryRun) console.log("\nRe-run with --delete to apply.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
