import type { FastifyInstance } from "fastify";
import { extractFromPdf } from "@bidwright/core";
import { db, bids, uploads } from "@bidwright/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, currentUserId } from "../auth/middleware";
import { savePdf, newStorageKey, readPdf, pdfExists } from "../storage/files";

/** Parse an ITB deadline string into a Date, or null if it isn't usable. */
export function parseDeadline(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** PDFs start with "%PDF-". Checking the magic bytes avoids burning an Opus
 *  call on a renamed .docx or an image. */
export function looksLikePdf(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}

export async function uploadRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.post("/itb", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    const buffer = await data.toBuffer();
    if (!looksLikePdf(buffer)) {
      return reply.status(400).send({ error: "That file isn't a PDF." });
    }

    const userId = currentUserId(req);

    try {
      // Keep the original: the editor's provenance needs to render it.
      const storageKey = newStorageKey();
      await savePdf(storageKey, buffer);

      // Extraction only. Generation is a separate call so the client can show
      // real progress, and so a generation failure doesn't throw away a good
      // (and expensive) extraction.
      const extraction = await extractFromPdf(buffer);

      const [inserted] = await db
        .insert(bids)
        .values({
          userId,
          itbFileName: data.filename,
          projectName: extraction.metadata.projectName ?? null,
          gcName: extraction.metadata.generalContractor ?? null,
          ownerName: extraction.metadata.owner ?? null,
          bidDeadline: parseDeadline(extraction.metadata.bidDeadline),
          primaryTrade: extraction.primaryTrade,
          status: "draft",
          extraction,
          lineItems: [],
          assumptions: [],
          clarifications: [],
          exclusions: [],
        })
        .returning();

      await db.insert(uploads).values({
        bidId: inserted.id,
        fileName: data.filename,
        fileSize: buffer.length,
        storagePath: storageKey,
      });

      return reply.send(inserted);
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({
        error: "We couldn't read that ITB. Please try again.",
      });
    }
  });

  /**
   * Stream a bid's source PDF. Scoped to the owner via the bid join.
   *
   * A forwarded ITB stores its drawings and addenda as uploads too, so this
   * filters to the primary rather than taking whichever row Postgres returns
   * first — otherwise the editor's provenance pane could render a wage
   * determination and cite it as the source of the scope.
   */
  app.get<{ Params: { bidId: string } }>("/:bidId/file", async (req, reply) => {
    const [row] = await db
      .select({ storagePath: uploads.storagePath, fileName: uploads.fileName })
      .from(uploads)
      .innerJoin(bids, eq(bids.id, uploads.bidId))
      .where(
        and(
          eq(uploads.bidId, req.params.bidId),
          eq(bids.userId, currentUserId(req)),
          eq(uploads.isPrimary, true),
        ),
      )
      .orderBy(uploads.createdAt)
      .limit(1);

    if (!row || !(await pdfExists(row.storagePath))) {
      return reply.status(404).send({ error: "Not found" });
    }

    const file = await readPdf(row.storagePath);
    return reply
      .header("content-type", "application/pdf")
      .header("content-disposition", `inline; filename="${encodeURIComponent(row.fileName)}"`)
      // The bytes never change for a given bid, and the URL is owner-scoped.
      .header("cache-control", "private, max-age=3600")
      .send(file);
  });
}
