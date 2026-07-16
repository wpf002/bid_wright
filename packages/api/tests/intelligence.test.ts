import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { isDatabaseReachable, uniqueEmail, TEST_DATABASE_URL } from "./helpers/db";

process.env.DATABASE_URL ??= TEST_DATABASE_URL;

const dbUp = await isDatabaseReachable();
const describeDb = dbUp ? describe : describe.skip;

describeDb("intelligence layer (real Postgres)", () => {
  let app: FastifyInstance;
  let alice: { token: string; userId: string };
  let bob: { token: string; userId: string };

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  async function register(app: FastifyInstance) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: uniqueEmail(), password: "correct-horse-battery" },
    });
    const b = res.json();
    return { token: b.token, userId: b.user.id };
  }

  /** Seed a bid with the given priced line items. */
  async function seedBid(
    userId: string,
    items: { description: string; unit: string; unitCostCents: number; quantity?: number }[],
    status = "draft",
  ): Promise<string> {
    const { db, bids } = await import("@bidwright/db");
    const [row] = await db
      .insert(bids)
      .values({
        userId,
        itbFileName: "itb.pdf",
        projectName: "Electrical Job",
        primaryTrade: "electrical",
        status,
        extraction: {},
        lineItems: items.map((it, i) => ({
          id: `li-${i}`,
          description: it.description,
          quantity: it.quantity ?? 1,
          unit: it.unit,
          unitCostCents: it.unitCostCents,
          totalCostCents: it.unitCostCents * (it.quantity ?? 1),
          notes: null,
          sourcePage: null,
          confidence: null,
        })),
        assumptions: [],
        clarifications: [],
        exclusions: [],
      })
      .returning();
    return row.id;
  }

  const finalize = (id: string, token: string, status = "submitted") =>
    app.inject({ method: "PATCH", url: `/api/bids/${id}`, headers: auth(token), payload: { status } });

  beforeAll(async () => {
    const { buildApp } = await import("../src/app");
    app = await buildApp({ jwtSecret: "test-secret-min-32-chars-1234567890" });
    alice = await register(app);
    bob = await register(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe("cost history population", () => {
    it("records priced line items when a bid is submitted", async () => {
      const id = await seedBid(alice.userId, [
        { description: "Install EMT conduit for branch circuits", unit: "LF", unitCostCents: 375 },
        { description: "Pull copper branch wiring THHN", unit: "LF", unitCostCents: 120 },
      ]);
      await finalize(id, alice.token);

      const res = await app.inject({ method: "GET", url: "/api/cost-history", headers: auth(alice.token) });
      expect(res.statusCode).toBe(200);
      const rows = res.json();
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows.some((r: { unitCostCents: number }) => r.unitCostCents === 375)).toBe(true);
    });

    it("does not record a draft bid — a draft price isn't real", async () => {
      const before = (await app.inject({ method: "GET", url: "/api/cost-history", headers: auth(alice.token) })).json().length;
      const id = await seedBid(alice.userId, [
        { description: "Draft only work item", unit: "EA", unitCostCents: 999 },
      ]);
      await app.inject({ method: "PATCH", url: `/api/bids/${id}`, headers: auth(alice.token), payload: { status: "draft" } });
      const after = (await app.inject({ method: "GET", url: "/api/cost-history", headers: auth(alice.token) })).json().length;
      expect(after).toBe(before);
    });

    it("skips unpriced items — $0 means not-yet-priced, not free", async () => {
      const id = await seedBid(alice.userId, [
        { description: "Unpriced placeholder scope alpha", unit: "EA", unitCostCents: 0 },
      ]);
      await finalize(id, alice.token);
      const rows = (await app.inject({ method: "GET", url: "/api/cost-history", headers: auth(alice.token) })).json();
      expect(rows.some((r: { description: string }) => r.description === "Unpriced placeholder scope alpha")).toBe(false);
    });

    it("is idempotent — re-finalizing doesn't double-count", async () => {
      const id = await seedBid(alice.userId, [
        { description: "Idempotency probe widget install", unit: "EA", unitCostCents: 500 },
      ]);
      await finalize(id, alice.token, "submitted");
      await finalize(id, alice.token, "won"); // submitted -> won is still one job
      await finalize(id, alice.token, "won");

      const rows = (await app.inject({ method: "GET", url: "/api/cost-history", headers: auth(alice.token) })).json();
      const matches = rows.filter((r: { description: string }) => r.description === "Idempotency probe widget install");
      expect(matches).toHaveLength(1);
    });

    it("keeps one user's pricing out of another's history", async () => {
      const id = await seedBid(bob.userId, [
        { description: "Bob secret pricing item", unit: "EA", unitCostCents: 4242 },
      ]);
      await finalize(id, bob.token);

      const aliceRows = (await app.inject({ method: "GET", url: "/api/cost-history", headers: auth(alice.token) })).json();
      expect(aliceRows.some((r: { unitCostCents: number }) => r.unitCostCents === 4242)).toBe(false);
    });
  });

  describe("cost suggestions", () => {
    it("suggests a price from the user's own history", async () => {
      const target = await seedBid(alice.userId, [
        { description: "Install EMT conduit for branch circuits", unit: "LF", unitCostCents: 0 },
      ]);
      const res = await app.inject({
        method: "GET",
        url: `/api/bids/${target}/cost-suggestions`,
        headers: auth(alice.token),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.suggestions["li-0"]).toBeDefined();
      expect(body.suggestions["li-0"].avgUnitCostCents).toBe(375);
      expect(body.suggestions["li-0"].confidence).toBe(1);
    });

    it("404s another user's bid", async () => {
      const id = await seedBid(alice.userId, [{ description: "x y z", unit: "EA", unitCostCents: 1 }]);
      const res = await app.inject({
        method: "GET",
        url: `/api/bids/${id}/cost-suggestions`,
        headers: auth(bob.token),
      });
      expect(res.statusCode).toBe(404);
    });

    it("returns no suggestions for a brand-new user", async () => {
      const fresh = await register(app);
      const id = await seedBid(fresh.userId, [{ description: "Install EMT conduit", unit: "LF", unitCostCents: 0 }]);
      const body = (await app.inject({
        method: "GET",
        url: `/api/bids/${id}/cost-suggestions`,
        headers: auth(fresh.token),
      })).json();
      expect(body.historySize).toBe(0);
      expect(body.coverage).toBe(0);
    });
  });

  describe("exit criterion: coverage after 5 bids in a trade", () => {
    it("suggests on >=50% of line items once the trade has history", async () => {
      const user = await register(app);
      const SCOPE = [
        { description: "Demolish and remove existing lighting fixtures", unit: "EA", unitCostCents: 1250 },
        { description: "Furnish and install LED 2x4 troffers", unit: "EA", unitCostCents: 8475 },
        { description: "Install EMT conduit for branch circuits", unit: "LF", unitCostCents: 375 },
        { description: "Pull copper branch wiring THHN", unit: "LF", unitCostCents: 120 },
        { description: "Furnish and install fire alarm devices", unit: "EA", unitCostCents: 9000 },
        { description: "Install 300 kVA transformer", unit: "EA", unitCostCents: 500000 },
      ];

      // Five finalized electrical bids, quantities varying as they would in life.
      for (let i = 0; i < 5; i++) {
        const id = await seedBid(user.userId, SCOPE.map((s) => ({ ...s, quantity: 10 + i })), "draft");
        await finalize(id, user.token);
      }

      // A sixth, unpriced bid with the same scope worded slightly differently.
      const sixth = await seedBid(user.userId, [
        { description: "Demolish and remove existing lighting fixtures", unit: "EA", unitCostCents: 0 },
        { description: "Furnish and install LED 2x4 troffers", unit: "EA", unitCostCents: 0 },
        { description: "Install approximately 4,200 LF of EMT conduit for branch circuits", unit: "LF", unitCostCents: 0 },
        { description: "Pull copper branch wiring THHN", unit: "LF", unitCostCents: 0 },
        { description: "Furnish and install fire alarm devices", unit: "EA", unitCostCents: 0 },
        { description: "Paint the parking lot stripes", unit: "LF", unitCostCents: 0 },
      ]);

      const body = (await app.inject({
        method: "GET",
        url: `/api/bids/${sixth}/cost-suggestions`,
        headers: auth(user.token),
      })).json();

      expect(body.coverage).toBeGreaterThanOrEqual(0.5);
      // The unrelated item must NOT get a price.
      expect(body.suggestions["li-5"]).toBeUndefined();
      // Averages come from five identical bids, so they equal the input.
      expect(body.suggestions["li-0"].avgUnitCostCents).toBe(1250);
      expect(body.suggestions["li-0"].sampleSize).toBe(5);
    });
  });

  describe("clause library", () => {
    it("creates, lists, and scopes clauses to the owner", async () => {
      const create = await app.inject({
        method: "POST",
        url: "/api/clauses",
        headers: auth(alice.token),
        payload: { kind: "exclusion", trade: "electrical", text: "Temporary power by others." },
      });
      expect(create.statusCode).toBe(201);

      const mine = (await app.inject({ method: "GET", url: "/api/clauses?kind=exclusion", headers: auth(alice.token) })).json();
      expect(mine.some((c: { text: string }) => c.text === "Temporary power by others.")).toBe(true);

      const bobs = (await app.inject({ method: "GET", url: "/api/clauses", headers: auth(bob.token) })).json();
      expect(bobs.some((c: { text: string }) => c.text === "Temporary power by others.")).toBe(false);
    });

    it("rejects an unknown kind", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/clauses",
        headers: auth(alice.token),
        payload: { kind: "nonsense", text: "x" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("bumps use count", async () => {
      const created = (await app.inject({
        method: "POST", url: "/api/clauses", headers: auth(alice.token),
        payload: { kind: "assumption", text: "Normal working hours." },
      })).json();
      await app.inject({ method: "POST", url: `/api/clauses/${created.id}/used`, headers: auth(alice.token) });
      const after = (await app.inject({ method: "POST", url: `/api/clauses/${created.id}/used`, headers: auth(alice.token) })).json();
      expect(after.useCount).toBe(2);
    });

    it("cannot delete another user's clause", async () => {
      const created = (await app.inject({
        method: "POST", url: "/api/clauses", headers: auth(alice.token),
        payload: { kind: "assumption", text: "Alice only clause." },
      })).json();
      const res = await app.inject({ method: "DELETE", url: `/api/clauses/${created.id}`, headers: auth(bob.token) });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("templates", () => {
    it("saves and lists a clause set", async () => {
      const created = await app.inject({
        method: "POST",
        url: "/api/templates",
        headers: auth(alice.token),
        payload: {
          name: "Standard electrical",
          trade: "electrical",
          assumptions: ["Normal hours."],
          clarifications: ["Confirm shutdown windows."],
          exclusions: ["Permits.", "Bonds."],
        },
      });
      expect(created.statusCode).toBe(201);
      expect(created.json().exclusions).toEqual(["Permits.", "Bonds."]);

      const list = (await app.inject({ method: "GET", url: "/api/templates", headers: auth(alice.token) })).json();
      expect(list.some((t: { name: string }) => t.name === "Standard electrical")).toBe(true);
    });

    it("scopes templates to the owner", async () => {
      const list = (await app.inject({ method: "GET", url: "/api/templates", headers: auth(bob.token) })).json();
      expect(list.some((t: { name: string }) => t.name === "Standard electrical")).toBe(false);
    });

    it("401s anonymously", async () => {
      expect((await app.inject({ method: "GET", url: "/api/templates" })).statusCode).toBe(401);
      expect((await app.inject({ method: "GET", url: "/api/cost-history" })).statusCode).toBe(401);
    });
  });
});
