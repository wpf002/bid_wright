import type { FastifyInstance } from "fastify";
import { extractFromPdf, generateBidResponse } from "@bidwright/core";
import { db, bids } from "@bidwright/db";
import { requireAuth, currentUserId } from "../auth/middleware";

/** Parse an ITB deadline string into a Date, or null if it isn't usable. */
function parseDeadline(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function uploadRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.post("/itb", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    const buffer = await data.toBuffer();

    try {
      const extraction = await extractFromPdf(buffer);
      const bid = await generateBidResponse(extraction, data.filename);

      const [inserted] = await db.insert(bids).values({
        userId: currentUserId(req),
        itbFileName: bid.itbFileName,
        projectName: bid.extraction.metadata.projectName ?? null,
        gcName: bid.extraction.metadata.ownerOrGc ?? null,
        bidDeadline: parseDeadline(bid.extraction.metadata.bidDeadline),
        primaryTrade: bid.extraction.primaryTrade,
        status: bid.status,
        extraction: bid.extraction,
        lineItems: bid.lineItems,
        assumptions: bid.assumptions,
        clarifications: bid.clarifications,
        exclusions: bid.exclusions,
        subtotalCents: bid.subtotalCents,
        overheadPercent: bid.overheadPercent,
        profitPercent: bid.profitPercent,
        totalCents: bid.totalCents,
        validityDays: bid.validityDays,
      }).returning();

      return reply.send(inserted);
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: "Processing failed", details: String(err) });
    }
  });
}
