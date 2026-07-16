import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { isDatabaseReachable, uniqueEmail, TEST_DATABASE_URL } from "./helpers/db";

process.env.DATABASE_URL ??= TEST_DATABASE_URL;

const dbUp = await isDatabaseReachable();
const describeDb = dbUp ? describe : describe.skip;

describeDb("outcomes + analytics (real Postgres)", () => {
  let app: FastifyInstance;
  let user: { token: string; userId: string };
  let other: { token: string; userId: string };

  const auth = (t: string) => ({ authorization: `Bearer ${t}` });

  async function register() {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: uniqueEmail(), password: "correct-horse-battery" },
    });
    const b = res.json();
    return { token: b.token, userId: b.user.id };
  }

  async function seedBid(userId: string, p: { gcName?: string; trade?: string; subtotal?: number; total?: number } = {}) {
    const { db, bids } = await import("@bidwright/db");
    const [row] = await db
      .insert(bids)
      .values({
        userId,
        itbFileName: "itb.pdf",
        projectName: "Project",
        gcName: p.gcName ?? "Turner Ridge",
        primaryTrade: p.trade ?? "electrical",
        status: "submitted",
        extraction: {},
        lineItems: [],
        assumptions: [],
        clarifications: [],
        exclusions: [],
        subtotalCents: p.subtotal ?? 100_000,
        totalCents: p.total ?? 118_000,
      })
      .returning();
    return row.id;
  }

  const setOutcome = (id: string, token: string, outcome: unknown) =>
    app.inject({ method: "PATCH", url: `/api/bids/${id}`, headers: auth(token), payload: { outcome } });

  beforeAll(async () => {
    const { buildApp } = await import("../src/app");
    app = await buildApp({ jwtSecret: "test-secret-min-32-chars-1234567890" });
    user = await register();
    other = await register();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe("recording an outcome", () => {
    it("stores the result and reason", async () => {
      const id = await seedBid(user.userId);
      const res = await setOutcome(id, user.token, { result: "lost", reason: "price_too_high" });
      expect(res.statusCode).toBe(200);
      expect(res.json().outcome).toMatchObject({ result: "lost", reason: "price_too_high" });
    });

    it("moves status in step with the outcome", async () => {
      const id = await seedBid(user.userId);
      const res = await setOutcome(id, user.token, { result: "won" });
      // Status and outcome drifting apart would make the board lie.
      expect(res.json().status).toBe("won");
    });

    it("stamps notedAt on the server, ignoring a client-supplied date", async () => {
      const id = await seedBid(user.userId);
      const res = await setOutcome(id, user.token, {
        result: "won",
        notedAt: "1999-01-01T00:00:00Z",
      });
      // Bid-to-award time is derived from this; a client clock would skew it.
      expect(new Date(res.json().outcome.notedAt).getUTCFullYear()).toBeGreaterThan(2020);
    });

    it("rejects an unknown result or reason", async () => {
      const id = await seedBid(user.userId);
      expect((await setOutcome(id, user.token, { result: "maybe" })).statusCode).toBe(400);
      expect((await setOutcome(id, user.token, { result: "lost", reason: "vibes" })).statusCode).toBe(400);
    });

    it("cannot set an outcome on someone else's bid", async () => {
      const id = await seedBid(user.userId);
      expect((await setOutcome(id, other.token, { result: "won" })).statusCode).toBe(404);
    });
  });

  describe("analytics", () => {
    it("401s anonymously", async () => {
      expect((await app.inject({ method: "GET", url: "/api/analytics" })).statusCode).toBe(401);
    });

    it("is safe on an empty account", async () => {
      const fresh = await register();
      const s = (await app.inject({ method: "GET", url: "/api/analytics", headers: auth(fresh.token) })).json();
      expect(s.totalBids).toBe(0);
      expect(s.overall.rate).toBeNull();
      expect(s.byGc).toEqual([]);
    });

    it("computes win rate from real recorded outcomes", async () => {
      const u = await register();
      const a = await seedBid(u.userId, { gcName: "Turner Ridge" });
      const b = await seedBid(u.userId, { gcName: "Turner Ridge" });
      const c = await seedBid(u.userId, { gcName: "Austin Commercial" });
      await setOutcome(a, u.token, { result: "won" });
      await setOutcome(b, u.token, { result: "lost", reason: "price_too_high" });
      await setOutcome(c, u.token, { result: "won" });

      const s = (await app.inject({ method: "GET", url: "/api/analytics", headers: auth(u.token) })).json();
      expect(s.decided).toBe(3);
      expect(s.overall.rate).toBeCloseTo(2 / 3);

      const turner = s.byGc.find((g: { key: string }) => g.key === "Turner Ridge");
      expect(turner.rate).toBe(0.5);
      expect(s.lossReasons[0]).toMatchObject({ reason: "price_too_high", count: 1 });
      expect(s.trend.length).toBeGreaterThan(0);
    });

    it("excludes withdrawn bids from win rate", async () => {
      const u = await register();
      const a = await seedBid(u.userId);
      const b = await seedBid(u.userId);
      await setOutcome(a, u.token, { result: "won" });
      await setOutcome(b, u.token, { result: "withdrawn", reason: "no_bid_submitted" });

      const s = (await app.inject({ method: "GET", url: "/api/analytics", headers: auth(u.token) })).json();
      expect(s.decided).toBe(1);
      expect(s.overall.rate).toBe(1);
    });

    it("never mixes another user's bids in", async () => {
      const u = await register();
      await seedBid(other.userId, { gcName: "Secret GC" });
      const s = (await app.inject({ method: "GET", url: "/api/analytics", headers: auth(u.token) })).json();
      expect(s.byGc.some((g: { key: string }) => g.key === "Secret GC")).toBe(false);
    });

    it("meets the exit criterion: renders with real data after 10 completed bids", async () => {
      const u = await register();
      for (let i = 0; i < 10; i++) {
        const id = await seedBid(u.userId, { gcName: i % 2 ? "Turner Ridge" : "Austin Commercial" });
        await setOutcome(id, u.token, i % 3 === 0 ? { result: "won" } : { result: "lost", reason: "price_too_high" });
      }
      const s = (await app.inject({ method: "GET", url: "/api/analytics", headers: auth(u.token) })).json();
      expect(s.decided).toBe(10);
      expect(s.overall.rate).not.toBeNull();
      expect(s.byGc.length).toBe(2);
      expect(s.averageBidToAwardDays).not.toBeNull();
      expect(s.averageMarginPercent).toBeCloseTo(18);
      // Win-rate trend is visible.
      expect(s.trend.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("gc history panel", () => {
    it("summarizes prior bids with this GC, excluding the one on screen", async () => {
      const u = await register();
      const a = await seedBid(u.userId, { gcName: "Hoar Construction" });
      const b = await seedBid(u.userId, { gcName: "Hoar Construction" });
      const current = await seedBid(u.userId, { gcName: "Hoar Construction" });
      await setOutcome(a, u.token, { result: "won" });
      await setOutcome(b, u.token, { result: "lost", reason: "timing" });

      const h = (await app.inject({
        method: "GET",
        url: `/api/bids/${current}/gc-history`,
        headers: auth(u.token),
      })).json();
      expect(h).toMatchObject({ total: 2, won: 1, lost: 1, rate: 0.5 });
    });

    it("returns null for a first-time GC", async () => {
      const u = await register();
      const id = await seedBid(u.userId, { gcName: "Brand New GC" });
      const res = await app.inject({ method: "GET", url: `/api/bids/${id}/gc-history`, headers: auth(u.token) });
      expect(res.json()).toBeNull();
    });

    it("404s another user's bid", async () => {
      const id = await seedBid(user.userId);
      expect(
        (await app.inject({ method: "GET", url: `/api/bids/${id}/gc-history`, headers: auth(other.token) })).statusCode,
      ).toBe(404);
    });
  });
});
