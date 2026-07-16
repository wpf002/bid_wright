import type { FastifyInstance } from "fastify";
import { db, bids } from "@bidwright/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { generateBidResponse } from "@bidwright/core";
import type { ExtractionResult } from "@bidwright/shared";
import { requireAuth, currentUserId } from "../auth/middleware";

/**
 * Every route here is scoped to the authenticated user. Cross-user access
 * returns 404 rather than 403 so the API doesn't confirm that another user's
 * bid id exists.
 */

/** Only these fields may be written by a client. */
const UpdateBidSchema = z.object({
  status: z.enum(["draft", "in_review", "submitted", "won", "lost", "withdrawn"]).optional(),
  lineItems: z.array(z.unknown()).optional(),
  assumptions: z.array(z.string()).optional(),
  clarifications: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
  subtotalCents: z.number().int().optional(),
  totalCents: z.number().int().optional(),
  overheadPercent: z.number().min(0).max(100).optional(),
  profitPercent: z.number().min(0).max(100).optional(),
  validityDays: z.number().int().positive().optional(),
  projectName: z.string().nullable().optional(),
  gcName: z.string().nullable().optional(),
  outcome: z.unknown().optional(),
});

export async function bidRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (req) => {
    return db
      .select()
      .from(bids)
      .where(eq(bids.userId, currentUserId(req)))
      .orderBy(desc(bids.createdAt));
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const [row] = await db
      .select()
      .from(bids)
      .where(and(eq(bids.id, req.params.id), eq(bids.userId, currentUserId(req))));
    if (!row) return reply.status(404).send({ error: "Not found" });
    return row;
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const parsed = UpdateBidSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const [updated] = await db
      .update(bids)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(bids.id, req.params.id), eq(bids.userId, currentUserId(req))))
      .returning();
    if (!updated) return reply.status(404).send({ error: "Not found" });
    return updated;
  });

  /**
   * Draft the response from this bid's stored extraction. Split out from upload
   * so the client can show real progress and retry generation without
   * re-running (or re-paying for) extraction.
   */
  app.post<{ Params: { id: string } }>("/:id/generate", async (req, reply) => {
    const [row] = await db
      .select()
      .from(bids)
      .where(and(eq(bids.id, req.params.id), eq(bids.userId, currentUserId(req))));
    if (!row) return reply.status(404).send({ error: "Not found" });

    try {
      const draft = await generateBidResponse(
        row.extraction as ExtractionResult,
        row.itbFileName,
      );
      const [updated] = await db
        .update(bids)
        .set({
          lineItems: draft.lineItems,
          assumptions: draft.assumptions,
          clarifications: draft.clarifications,
          exclusions: draft.exclusions,
          subtotalCents: draft.subtotalCents,
          overheadPercent: draft.overheadPercent,
          profitPercent: draft.profitPercent,
          totalCents: draft.totalCents,
          validityDays: draft.validityDays,
          updatedAt: new Date(),
        })
        .where(and(eq(bids.id, req.params.id), eq(bids.userId, currentUserId(req))))
        .returning();
      return updated;
    } catch (err) {
      app.log.error(err);
      // The extraction survives; the client can retry generation alone.
      return reply.status(500).send({ error: "We couldn't draft the response. Please try again." });
    }
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const [deleted] = await db
      .delete(bids)
      .where(and(eq(bids.id, req.params.id), eq(bids.userId, currentUserId(req))))
      .returning();
    if (!deleted) return reply.status(404).send({ error: "Not found" });
    return reply.status(204).send();
  });
}
