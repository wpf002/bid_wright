import { describe, it, expect, vi, afterEach } from "vitest";
import { TEST_DATABASE_URL } from "./helpers/db";
// sweep-policy imports nothing — that's the point of it living apart from the
// IO, and why this one can be a static import.
import { shouldRefuseSweep } from "../src/storage/sweep-policy";

// The scheduler pulls in the db client transitively (it never queries here),
// and that client throws at import without this. Static imports are hoisted
// above assignments, so the scheduler is imported dynamically below.
process.env.DATABASE_URL ??= TEST_DATABASE_URL;

const loadScheduler = async () => (await import("../src/storage/scheduler")).startStorageSweeper;

/**
 * The guard and the scheduler, tested without a database.
 *
 * These matter more than the rest of the retention suite: once the sweep runs
 * unattended, nobody is reading a dry-run list, and the guard is the only thing
 * between a misconfigured DATABASE_URL and every document on disk.
 */

describe("shouldRefuseSweep", () => {
  it("refuses when nothing on disk is referenced — the wrong-database signature", () => {
    // Empty or un-migrated DATABASE_URL: no rows, so nothing matches.
    expect(shouldRefuseSweep({ referencedOnDiskCount: 0, fileCount: 6 })).toBe(true);
    expect(shouldRefuseSweep({ referencedOnDiskCount: 0, fileCount: 4000 })).toBe(true);
  });

  it("refuses on the wrong-directory signature too", () => {
    // Rows exist and are perfectly healthy, but none of them name the files in
    // front of us — a misconfigured UPLOAD_DIR, whose files may not be ours at
    // all. Keying off row count alone would sail past this and delete them.
    expect(shouldRefuseSweep({ referencedOnDiskCount: 0, fileCount: 50 })).toBe(true);
  });

  it("allows a normal sweep where some files are referenced", () => {
    expect(shouldRefuseSweep({ referencedOnDiskCount: 7, fileCount: 19 })).toBe(false);
    expect(shouldRefuseSweep({ referencedOnDiskCount: 1, fileCount: 500 })).toBe(false);
  });

  it("doesn't cry wolf on a dev box with a couple of stray files", () => {
    expect(shouldRefuseSweep({ referencedOnDiskCount: 0, fileCount: 4 })).toBe(false);
    expect(shouldRefuseSweep({ referencedOnDiskCount: 0, fileCount: 0 })).toBe(false);
  });

  it("can be overridden deliberately", () => {
    // The refusal must not be a dead end for someone who knows the state is real.
    expect(shouldRefuseSweep({ referencedOnDiskCount: 0, fileCount: 100, force: true })).toBe(false);
  });
});

describe("startStorageSweeper", () => {
  afterEach(() => vi.useRealTimers());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fakeLog = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) as any;

  it("does not sweep at boot", async () => {
    // `tsx watch` restarts the API on every keystroke; a sweep per boot would be
    // constant destructive churn in dev.
    vi.useFakeTimers();
    const log = fakeLog();
    const startStorageSweeper = await loadScheduler();
    const sweeper = startStorageSweeper({ log, initialDelayMs: 60_000, intervalMs: 120_000 });
    const spy = vi.spyOn(sweeper, "runOnce");

    await vi.advanceTimersByTimeAsync(59_000);
    expect(spy).not.toHaveBeenCalled();
    sweeper.stop();
  });

  it("stops cleanly, so a closed app leaves no timer behind", async () => {
    vi.useFakeTimers();
    const log = fakeLog();
    const startStorageSweeper = await loadScheduler();
    const sweeper = startStorageSweeper({ log, initialDelayMs: 1000, intervalMs: 1000 });
    sweeper.stop();

    // Nothing should be scheduled after stop.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("logs the schedule it actually set, not a hardcoded claim", async () => {
    const startStorageSweeper = await loadScheduler();
    const log = fakeLog();
    const sweeper = startStorageSweeper({
      log,
      intervalMs: 6 * 60 * 60 * 1000,
      initialDelayMs: 2 * 60 * 60 * 1000,
      retentionDays: 90,
    });
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ intervalHours: 6, firstRunInHours: 2, retentionDays: 90 }),
      "storage sweep scheduled",
    );
    sweeper.stop();
  });
});
