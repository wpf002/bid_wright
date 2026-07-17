import type { FastifyBaseLogger } from "fastify";
import { sweepOrphans, purgeExpiredSupporting, DEFAULT_SUPPORTING_RETENTION_DAYS } from "./retention";

/**
 * Runs the storage sweep on a timer.
 *
 * Started from the server entrypoint, never from buildApp — tests build the app
 * directly, and a destructive job must not be one import away from firing
 * inside a test run.
 *
 * In-process on purpose: the app has no scheduler, and adding cron or a queue to
 * delete a handful of files would be more moving parts than the problem has.
 * The tradeoff is that N API instances means N sweepers. The work is
 * idempotent (unlink is force:true, the row delete is a no-op the second time),
 * so concurrent runs waste effort rather than corrupt anything — but if this
 * ever runs multi-instance, move it out.
 */

export interface SweeperOptions {
  log: FastifyBaseLogger;
  /** Default 24h. */
  intervalMs?: number;
  /**
   * Wait before the first run. Not zero: `tsx watch` restarts the API on every
   * keystroke, and a sweep on each boot would be constant destructive churn in
   * dev for no benefit.
   */
  initialDelayMs?: number;
  /** Also age out supporting files past the retention window. */
  retention?: boolean;
  retentionDays?: number;
}

const HOUR = 60 * 60 * 1000;

export interface Sweeper {
  /** Run now, outside the schedule. Exposed for tests. */
  runOnce(): Promise<void>;
  stop(): void;
}

export function startStorageSweeper(opts: SweeperOptions): Sweeper {
  const intervalMs = opts.intervalMs ?? 24 * HOUR;
  const initialDelayMs = opts.initialDelayMs ?? HOUR;
  const retention = opts.retention ?? true;
  const retentionDays = opts.retentionDays ?? DEFAULT_SUPPORTING_RETENTION_DAYS;
  const log = opts.log;

  // A slow sweep must not stack up behind itself if the interval comes round
  // again — two concurrent passes over the same directory is wasted IO at best.
  let running = false;
  let timer: NodeJS.Timeout | undefined;

  async function runOnce() {
    if (running) {
      log.warn("storage sweep still running from the last tick — skipping this one");
      return;
    }
    running = true;
    try {
      const orphans = await sweepOrphans({ dryRun: false });
      if (orphans.aborted) {
        // Loud: this means the sweep found a state it won't act on, and the
        // reason is almost always a misconfiguration worth a human's attention.
        log.error({ reason: orphans.aborted }, "storage sweep refused to run");
      } else if (orphans.removed.length > 0) {
        log.info(
          { files: orphans.removed.length, bytes: orphans.bytes },
          "storage sweep removed orphaned files",
        );
      }

      if (retention) {
        const purged = await purgeExpiredSupporting({ olderThanDays: retentionDays, dryRun: false });
        if (purged.removed.length > 0) {
          log.info(
            { files: purged.removed.length, bytes: purged.bytes, olderThanDays: retentionDays },
            "storage sweep aged out supporting files",
          );
        }
      }
    } catch (err) {
      // A failed sweep is a disk cost, not an outage. Never let it take the
      // process down — the next tick tries again.
      log.error({ err }, "storage sweep failed");
    } finally {
      running = false;
    }
  }

  const start = setTimeout(() => {
    void runOnce();
    timer = setInterval(() => void runOnce(), intervalMs);
    // Housekeeping must never be the reason the process won't exit.
    timer.unref();
  }, initialDelayMs);
  start.unref();

  log.info(
    { intervalHours: intervalMs / HOUR, firstRunInHours: initialDelayMs / HOUR, retention, retentionDays },
    "storage sweep scheduled",
  );

  return {
    runOnce,
    stop() {
      clearTimeout(start);
      if (timer) clearInterval(timer);
    },
  };
}
