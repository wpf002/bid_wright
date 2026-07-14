import type { FastifyInstance } from "fastify";
import { extractFromPdf, generateBidResponse } from "@bidwright/core";
import { db, bids } from "@bidwright/db";

export async function uploadRoutes(app: FastifyInstance) {
  app.post("/itb", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    const buffer = await data.toBuffer();

    try {
      const extraction = await extractFromPdf(buffer);
      const bid = await generateBidResponse(extraction, data.filename);

      const [inserted] = await db.insert(bids).values({
        itbFileName: bid.itbFileName,
        projectName: bid.extraction.metadata.projectName ?? null,
        gcName: bid.extraction.metadata.ownerOrGc ?? null,
        bidDeadline: bid.extraction.metadata.bidDeadline
          ? new Date(bid.extraction.metadata.bidDeadline) : null,
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
