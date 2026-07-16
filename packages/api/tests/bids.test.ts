import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { isDatabaseReachable, uniqueEmail, TEST_DATABASE_URL } from "./helpers/db";

process.env.DATABASE_URL ??= TEST_DATABASE_URL;

const dbUp = await isDatabaseReachable();
const describeDb = dbUp ? describe : describe.skip;

describeDb("bid ownership isolation (real Postgres)", () => {
  let app: FastifyInstance;
  let alice: { token: string; userId: string };
  let bob: { token: string; userId: string };
  let aliceBidId: string;

  async function register(app: FastifyInstance) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: uniqueEmail(), password: "correct-horse-battery" },
    });
    const body = res.json();
    return { token: body.token, userId: body.user.id };
  }

  /** Insert a bid directly — the upload route needs the Anthropic API. */
  async function seedBid(userId: string, projectName: string): Promise<string> {
    const { db, bids } = await import("@bidwright/db");
    const [row] = await db
      .insert(bids)
      .values({
        userId,
        itbFileName: "test-itb.pdf",
        projectName,
        status: "draft",
        extraction: {},
        lineItems: [],
        assumptions: [],
        clarifications: [],
        exclusions: [],
      })
      .returning();
    return row.id;
  }

  beforeAll(async () => {
    const { buildApp } = await import("../src/app");
    app = await buildApp({ jwtSecret: "test-secret-min-32-chars-1234567890" });
    alice = await register(app);
    bob = await register(app);
    aliceBidId = await seedBid(alice.userId, "Alice Project");
    await seedBid(bob.userId, "Bob Project");
  });

  afterAll(async () => {
    await app?.close();
  });

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  describe("authentication is required", () => {
    it("GET /api/bids 401s anonymously", async () => {
      const res = await app.inject({ method: "GET", url: "/api/bids" });
      expect(res.statusCode).toBe(401);
    });

    it("GET /api/bids/:id 401s anonymously", async () => {
      const res = await app.inject({ method: "GET", url: `/api/bids/${aliceBidId}` });
      expect(res.statusCode).toBe(401);
    });

    it("PATCH 401s anonymously", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/bids/${aliceBidId}`,
        payload: { status: "won" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("DELETE 401s anonymously", async () => {
      const res = await app.inject({ method: "DELETE", url: `/api/bids/${aliceBidId}` });
      expect(res.statusCode).toBe(401);
    });

    it("upload 401s anonymously", async () => {
      const res = await app.inject({ method: "POST", url: "/api/uploads/itb" });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("listing is scoped to the owner", () => {
    it("Alice sees only her own bids", async () => {
      const res = await app.inject({ method: "GET", url: "/api/bids", headers: auth(alice.token) });
      expect(res.statusCode).toBe(200);
      const rows = res.json();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r: { userId: string }) => r.userId === alice.userId)).toBe(true);
      expect(rows.some((r: { projectName: string }) => r.projectName === "Bob Project")).toBe(false);
    });

    it("Bob sees only his own bids", async () => {
      const res = await app.inject({ method: "GET", url: "/api/bids", headers: auth(bob.token) });
      const rows = res.json();
      expect(rows.every((r: { userId: string }) => r.userId === bob.userId)).toBe(true);
    });
  });

  describe("cross-user access is denied", () => {
    it("Bob gets 404 reading Alice's bid (not 403 — don't confirm it exists)", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/bids/${aliceBidId}`,
        headers: auth(bob.token),
      });
      expect(res.statusCode).toBe(404);
    });

    it("Bob cannot PATCH Alice's bid", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/bids/${aliceBidId}`,
        headers: auth(bob.token),
        payload: { status: "won" },
      });
      expect(res.statusCode).toBe(404);

      // and Alice's bid is untouched
      const check = await app.inject({
        method: "GET",
        url: `/api/bids/${aliceBidId}`,
        headers: auth(alice.token),
      });
      expect(check.json().status).toBe("draft");
    });

    it("Bob cannot DELETE Alice's bid", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/bids/${aliceBidId}`,
        headers: auth(bob.token),
      });
      expect(res.statusCode).toBe(404);

      const check = await app.inject({
        method: "GET",
        url: `/api/bids/${aliceBidId}`,
        headers: auth(alice.token),
      });
      expect(check.statusCode).toBe(200);
    });
  });

  describe("owner can read and update", () => {
    it("Alice can read her own bid", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/bids/${aliceBidId}`,
        headers: auth(alice.token),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().projectName).toBe("Alice Project");
    });

    it("Alice can update her own bid", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/bids/${aliceBidId}`,
        headers: auth(alice.token),
        payload: { status: "in_review", validityDays: 45 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("in_review");
      expect(res.json().validityDays).toBe(45);
    });

    it("rejects an unknown status", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/bids/${aliceBidId}`,
        headers: auth(alice.token),
        payload: { status: "not-a-status" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("ignores attempts to reassign ownership", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/bids/${aliceBidId}`,
        headers: auth(alice.token),
        payload: { userId: bob.userId, status: "draft" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().userId).toBe(alice.userId);
    });

    it("404s an unknown bid id", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/bids/00000000-0000-0000-0000-000000000000",
        headers: auth(alice.token),
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
