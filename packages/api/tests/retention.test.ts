import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { isDatabaseReachable, uniqueEmail, TEST_DATABASE_URL } from "./helpers/db";

process.env.DATABASE_URL ??= TEST_DATABASE_URL;

const dbUp = await isDatabaseReachable();
const describeDb = dbUp ? describe : describe.skip;

const PDF = Buffer.from("%PDF-1.4\ntest\n%%EOF\n");

describeDb("upload retention (real Postgres)", () => {
  let app: FastifyInstance;
  let tmp: string;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    // A scratch upload dir so a sweep in here can never touch real uploads.
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "bw-retention-"));
    process.env.BIDWRIGHT_ROOT = tmp;
    process.env.UPLOAD_DIR = "uploads";
    await fs.mkdir(path.join(tmp, "uploads"), { recursive: true });

    const { buildApp } = await import("../src/app");
    app = await buildApp({ jwtSecret: "test-secret-min-32-chars-1234567890" });

    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: uniqueEmail(), password: "correct-horse-battery" },
    });
    token = reg.json().token;
    userId = reg.json().user.id;
  });

  afterAll(async () => {
    await app?.close();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  const auth = (t: string) => ({ authorization: `Bearer ${t}` });

  /** A bid with a primary file plus optional supporting files, on disk and in the DB. */
  async function makeBid(opts: { supporting?: number; owner?: string } = {}) {
    const { db, bids, uploads } = await import("@bidwright/db");
    const { newStorageKey, savePdf } = await import("../src/storage/files");

    const [bid] = await db
      .insert(bids)
      .values({
        userId: opts.owner ?? userId,
        itbFileName: "itb.pdf",
        status: "draft",
        extraction: {},
        lineItems: [],
        assumptions: [],
        clarifications: [],
        exclusions: [],
      })
      .returning();

    const keys: string[] = [];
    const primary = newStorageKey();
    await savePdf(primary, PDF);
    await db.insert(uploads).values({
      bidId: bid.id, fileName: "itb.pdf", fileSize: PDF.length,
      storagePath: primary, isPrimary: true,
    });
    keys.push(primary);

    for (let i = 0; i < (opts.supporting ?? 0); i++) {
      const key = newStorageKey();
      await savePdf(key, PDF);
      await db.insert(uploads).values({
        bidId: bid.id, fileName: `support-${i}.pdf`, fileSize: PDF.length,
        storagePath: key, isPrimary: false,
      });
      keys.push(key);
    }

    return { bid, keys };
  }

  const onDisk = async (key: string) =>
    fs.access(path.join(tmp, "uploads", key)).then(() => true).catch(() => false);

  it("deletes a bid's files from disk, not just its rows", async () => {
    // The whole bug: rows cascaded, bytes stayed forever.
    const { bid, keys } = await makeBid({ supporting: 2 });
    for (const k of keys) expect(await onDisk(k)).toBe(true);

    const res = await app.inject({
      method: "DELETE", url: `/api/bids/${bid.id}`, headers: auth(token),
    });
    expect(res.statusCode).toBe(204);

    for (const k of keys) expect(await onDisk(k)).toBe(false);
  });

  it("leaves another user's files alone when their bid id is named", async () => {
    // storageKeysForBid feeds unlink directly, so an unscoped lookup here would
    // let anyone delete anyone's documents by guessing an id.
    const other = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: uniqueEmail("victim"), password: "correct-horse-battery" },
    });
    const victim = await makeBid({ supporting: 1, owner: other.json().user.id });

    const res = await app.inject({
      method: "DELETE", url: `/api/bids/${victim.bid.id}`, headers: auth(token),
    });
    expect(res.statusCode).toBe(404);

    for (const k of victim.keys) expect(await onDisk(k)).toBe(true);
  });

  it("still succeeds when a file is already gone from disk", async () => {
    // A half-completed earlier delete must not make the bid undeletable.
    const { bid, keys } = await makeBid();
    await fs.rm(path.join(tmp, "uploads", keys[0]), { force: true });

    const res = await app.inject({
      method: "DELETE", url: `/api/bids/${bid.id}`, headers: auth(token),
    });
    expect(res.statusCode).toBe(204);
  });

  describe("sweepOrphans", () => {
    it("reports without deleting by default", async () => {
      // Dry-run is the guard against a wrong DATABASE_URL wiping every file.
      const { sweepOrphans } = await import("../src/storage/retention");
      const orphan = "orphan-dryrun.pdf";
      await fs.writeFile(path.join(tmp, "uploads", orphan), PDF);
      await ageFile(orphan);

      const result = await sweepOrphans();
      expect(result.dryRun).toBe(true);
      expect(result.removed).toContain(orphan);
      expect(await onDisk(orphan)).toBe(true);
    });

    it("removes unreferenced files when told to", async () => {
      const { sweepOrphans } = await import("../src/storage/retention");
      const orphan = "orphan-real.pdf";
      await fs.writeFile(path.join(tmp, "uploads", orphan), PDF);
      await ageFile(orphan);

      const result = await sweepOrphans({ dryRun: false });
      expect(result.removed).toContain(orphan);
      expect(await onDisk(orphan)).toBe(false);
    });

    it("never touches a file an upload row references", async () => {
      const { sweepOrphans } = await import("../src/storage/retention");
      const { keys } = await makeBid({ supporting: 1 });
      await Promise.all(keys.map(ageFile));

      await sweepOrphans({ dryRun: false });
      for (const k of keys) expect(await onDisk(k)).toBe(true);
    });

    it("spares a file young enough to be a live upload", async () => {
      // An upload writes bytes before committing its row; without the grace
      // window a sweep would delete a file about to be referenced.
      const { sweepOrphans } = await import("../src/storage/retention");
      const fresh = "just-written.pdf";
      await fs.writeFile(path.join(tmp, "uploads", fresh), PDF);

      const result = await sweepOrphans({ dryRun: false });
      expect(result.removed).not.toContain(fresh);
      expect(await onDisk(fresh)).toBe(true);
    });

    it("spares a letterhead, which lives here but is referenced from users", async () => {
      // Sweeping on the uploads table alone would delete every logo.
      const { db, users } = await import("@bidwright/db");
      const { eq } = await import("drizzle-orm");
      const { sweepOrphans } = await import("../src/storage/retention");

      const logo = "company-logo.png";
      await fs.writeFile(path.join(tmp, "uploads", logo), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      await ageFile(logo);
      await db.update(users).set({ logoStoragePath: logo }).where(eq(users.id, userId));

      const result = await sweepOrphans({ dryRun: false });
      expect(result.removed).not.toContain(logo);
      expect(await onDisk(logo)).toBe(true);
    });
  });

  describe("purgeExpiredSupporting", () => {
    it("never purges the primary — it's the document the bid rests on", async () => {
      const { purgeExpiredSupporting } = await import("../src/storage/retention");
      const { keys } = await makeBid({ supporting: 1 });
      await backdateUploads(400);

      await purgeExpiredSupporting({ olderThanDays: 1, dryRun: false });
      // keys[0] is the primary; it survives however old it gets.
      expect(await onDisk(keys[0])).toBe(true);
    });

    it("ages out old supporting files", async () => {
      const { purgeExpiredSupporting } = await import("../src/storage/retention");
      const { keys } = await makeBid({ supporting: 2 });
      await backdateUploads(400);

      const result = await purgeExpiredSupporting({ olderThanDays: 365, dryRun: false });
      expect(result.removed.length).toBeGreaterThanOrEqual(2);
      expect(await onDisk(keys[1])).toBe(false);
      expect(await onDisk(keys[2])).toBe(false);
    });

    it("keeps supporting files that aren't old enough yet", async () => {
      const { purgeExpiredSupporting } = await import("../src/storage/retention");
      const { keys } = await makeBid({ supporting: 1 });

      await purgeExpiredSupporting({ olderThanDays: 180, dryRun: false });
      expect(await onDisk(keys[1])).toBe(true);
    });
  });

  /** Push a file's mtime past the sweep's grace window. */
  async function ageFile(name: string) {
    const old = new Date(Date.now() - 4 * 60 * 60 * 1000);
    await fs.utimes(path.join(tmp, "uploads", name), old, old);
  }

  /** Backdate every upload row so a retention cutoff can be tested. */
  async function backdateUploads(days: number) {
    const { db, uploads } = await import("@bidwright/db");
    await db.update(uploads).set({ createdAt: new Date(Date.now() - days * 86_400_000) });
  }
});
