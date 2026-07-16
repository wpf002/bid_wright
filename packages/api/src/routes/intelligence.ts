import type { FastifyInstance } from "fastify";
import { db, bids, costHistory, userClauses, templates } from "@bidwright/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import type { BidLineItem } from "@bidwright/shared";
import { suggestCostsForItems, toCostRecord, type CostRecord } from "@bidwright/core";
import { requireAuth, currentUserId } from "../auth/middleware";

/**
 * Phase 4 — the intelligence layer: the user's own cost history, reusable
 * clauses, and templates. Everything here is scoped to the owner; a user's
 * pricing history is the most sensitive data in the product.
 */

const CLAUSE_KINDS = ["assumption", "clarification", "exclusion"] as const;

const ClauseSchema = z.object({
  kind: z.enum(CLAUSE_KINDS),
  trade: z.string().nullable().optional(),
  text: z.string().min(1).max(2000),
});

const TemplateSchema = z.object({
  name: z.string().min(1).max(120),
  trade: z.string().nullable().optional(),
  assumptions: z.array(z.string()),
  clarifications: z.array(z.string()),
  exclusions: z.array(z.string()),
});

/** Statuses that mean the bid actually went out — only then is a price real. */
const FINALIZED = new Set(["submitted", "won", "lost"]);

/**
 * Record every priced line item of a finalized bid into the user's history.
 * Unpriced items are skipped: a $0 line means "not yet priced", and feeding
 * zeros back would poison every future average.
 *
 * Idempotent via the (bid_id, normalized_key, unit) unique index — re-finalizing
 * or flipping submitted -> won must not double-count.
 */
export async function recordCostHistory(bidId: string): Promise<number> {
  const [row] = await db.select().from(bids).where(eq(bids.id, bidId));
  if (!row || !row.userId || !FINALIZED.has(row.status)) return 0;

  const items = (row.lineItems ?? []) as BidLineItem[];
  const priced = items.filter((li) => li.unitCostCents > 0 && li.description.trim() !== "");
  if (priced.length === 0) return 0;

  const trade = row.primaryTrade ?? "other";
  const values = priced.map((li) => ({
    userId: row.userId as string,
    bidId: row.id,
    ...toCostRecord(li, trade),
  }));

  // Two line items on one bid can normalize to the same key (e.g. the same work
  // split across floors); dedupe so the insert doesn't violate the index.
  const deduped = new Map<string, (typeof values)[number]>();
  for (const v of values) deduped.set(`${v.normalizedKey}|${v.unit}`, v);

  const inserted = await db
    .insert(costHistory)
    .values([...deduped.values()])
    .onConflictDoNothing()
    .returning({ id: costHistory.id });

  return inserted.length;
}

export async function intelligenceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  /** Cost suggestions for one bid's line items, from this user's own history. */
  app.get<{ Params: { id: string } }>("/bids/:id/cost-suggestions", async (req, reply) => {
    const userId = currentUserId(req);
    const [row] = await db
      .select()
      .from(bids)
      .where(and(eq(bids.id, req.params.id), eq(bids.userId, userId)));
    if (!row) return reply.status(404).send({ error: "Not found" });

    const trade = row.primaryTrade ?? "other";
    // Only this user's history, only this trade — indexed by cost_history_match_idx.
    const history = await db
      .select()
      .from(costHistory)
      .where(and(eq(costHistory.userId, userId), eq(costHistory.trade, trade)));

    const items = (row.lineItems ?? []) as BidLineItem[];
    const suggestions = suggestCostsForItems(
      items.map((li) => ({ id: li.id, description: li.description, unit: li.unit })),
      history as unknown as CostRecord[],
      trade,
    );

    return {
      trade,
      historySize: history.length,
      /** How many of this bid's line items we can price from history. */
      coverage: items.length === 0 ? 0 : Object.keys(suggestions).length / items.length,
      suggestions,
    };
  });

  /** The user's cost history, newest first — for Settings/debugging. */
  app.get("/cost-history", async (req) => {
    return db
      .select()
      .from(costHistory)
      .where(eq(costHistory.userId, currentUserId(req)))
      .orderBy(desc(costHistory.createdAt))
      .limit(500);
  });

  // ---- clause library -----------------------------------------------------

  app.get<{ Querystring: { kind?: string; trade?: string } }>("/clauses", async (req) => {
    const userId = currentUserId(req);
    const filters = [eq(userClauses.userId, userId)];
    if (req.query.kind) filters.push(eq(userClauses.kind, req.query.kind));
    return db
      .select()
      .from(userClauses)
      .where(and(...filters))
      // Most-used first: the picker should surface what this firm actually says.
      .orderBy(desc(userClauses.useCount), desc(userClauses.createdAt));
  });

  app.post("/clauses", async (req, reply) => {
    const parsed = ClauseSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const [created] = await db
      .insert(userClauses)
      .values({
        userId: currentUserId(req),
        kind: parsed.data.kind,
        trade: parsed.data.trade ?? null,
        text: parsed.data.text.trim(),
      })
      .returning();
    return reply.status(201).send(created);
  });

  app.patch<{ Params: { id: string } }>("/clauses/:id", async (req, reply) => {
    const parsed = ClauseSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const [updated] = await db
      .update(userClauses)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(userClauses.id, req.params.id), eq(userClauses.userId, currentUserId(req))))
      .returning();
    if (!updated) return reply.status(404).send({ error: "Not found" });
    return updated;
  });

  /** Bump use_count when a clause is inserted into a bid. */
  app.post<{ Params: { id: string } }>("/clauses/:id/used", async (req, reply) => {
    const [updated] = await db
      .update(userClauses)
      .set({ useCount: sql`${userClauses.useCount} + 1` })
      .where(and(eq(userClauses.id, req.params.id), eq(userClauses.userId, currentUserId(req))))
      .returning();
    if (!updated) return reply.status(404).send({ error: "Not found" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/clauses/:id", async (req, reply) => {
    const [deleted] = await db
      .delete(userClauses)
      .where(and(eq(userClauses.id, req.params.id), eq(userClauses.userId, currentUserId(req))))
      .returning();
    if (!deleted) return reply.status(404).send({ error: "Not found" });
    return reply.status(204).send();
  });

  // ---- templates ----------------------------------------------------------

  app.get("/templates", async (req) => {
    return db
      .select()
      .from(templates)
      .where(eq(templates.userId, currentUserId(req)))
      .orderBy(desc(templates.updatedAt));
  });

  app.post("/templates", async (req, reply) => {
    const parsed = TemplateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const [created] = await db
      .insert(templates)
      .values({
        userId: currentUserId(req),
        name: parsed.data.name.trim(),
        trade: parsed.data.trade ?? null,
        assumptions: parsed.data.assumptions,
        clarifications: parsed.data.clarifications,
        exclusions: parsed.data.exclusions,
      })
      .returning();
    return reply.status(201).send(created);
  });

  app.delete<{ Params: { id: string } }>("/templates/:id", async (req, reply) => {
    const [deleted] = await db
      .delete(templates)
      .where(and(eq(templates.id, req.params.id), eq(templates.userId, currentUserId(req))))
      .returning();
    if (!deleted) return reply.status(404).send({ error: "Not found" });
    return reply.status(204).send();
  });
}
