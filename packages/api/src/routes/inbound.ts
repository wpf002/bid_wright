import type { FastifyInstance } from "fastify";
import { db, users, bids, uploads, inboundMessages, costHistory } from "@bidwright/db";
import { eq, and, isNotNull, desc } from "drizzle-orm";
import {
  detectItb, extractFromPdf, choosePdf,
  type InboundEmail, type InboundAttachment,
} from "@bidwright/core";
import { savePdf, newStorageKey } from "../storage/files";
import { parseDeadline, looksLikePdf } from "./uploads";
import {
  normalizePostmark, parseInboundToken, verifyInboundSecret,
  type PostmarkInbound, type InboundAttachmentData,
} from "../inbox/postmark";

/**
 * Inbound mail: a user forwards (or auto-forwards) an ITB to their private
 * address and it lands on their bid board.
 *
 * Chosen over OAuth because reading Gmail attachments needs the restricted
 * gmail.readonly scope — Google verification plus an annual CASA assessment —
 * and IMAP needs the same, since basic auth is gone. A forwarding address
 * needs none of it, works with any provider, and shares only what the user
 * forwards.
 *
 * This route is unauthenticated by necessity (the provider POSTs it), so the
 * URL secret is the only gate. Everything downstream is scoped to the user the
 * address resolves to.
 */

/** GC domains this user has bid with — a detection signal from their own data. */
async function knownGcDomains(userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ gcName: bids.gcName })
    .from(bids)
    .where(and(eq(bids.userId, userId), isNotNull(bids.gcName)))
    .limit(200);

  // We store GC names, not domains, so derive candidates from the addresses we
  // have actually received mail from for this user.
  const senders = await db
    .selectDistinct({ from: inboundMessages.fromAddress })
    .from(inboundMessages)
    .where(and(eq(inboundMessages.userId, userId), eq(inboundMessages.classification, "itb")))
    .limit(200);

  const domains = new Set<string>();
  for (const s of senders) {
    const at = s.from.lastIndexOf("@");
    if (at !== -1) domains.add(s.from.slice(at + 1).toLowerCase());
  }
  void rows; // gcName is a display name; kept for future name->domain mapping
  return [...domains];
}

export async function inboundRoutes(app: FastifyInstance) {
  /**
   * Postmark inbound webhook. Always answers 200 once the secret checks out:
   * a non-2xx makes the provider retry, and retrying a message we've decided
   * to ignore just burns quota.
   */
  app.post<{ Querystring: { secret?: string }; Body: PostmarkInbound }>(
    "/postmark",
    async (req, reply) => {
      if (!verifyInboundSecret(req.query.secret, process.env.INBOUND_WEBHOOK_SECRET)) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { email, attachmentData } = normalizePostmark(req.body ?? {});
      const token = parseInboundToken(email.to);
      if (!token) {
        app.log.warn({ to: email.to }, "inbound mail with no routable token");
        return reply.send({ status: "ignored", reason: "no token" });
      }

      const [user] = await db.select().from(users).where(eq(users.inboundToken, token));
      if (!user) {
        app.log.warn({ token }, "inbound mail for unknown token");
        return reply.send({ status: "ignored", reason: "unknown address" });
      }

      const result = await ingestInboundEmail(app, user.id, email, attachmentData);
      return reply.send(result);
    },
  );
}

/**
 * Store the attachments we didn't extract from.
 *
 * Best-effort by design: a drawing set we failed to save is not a reason to
 * throw away a bid we successfully extracted, so each failure is logged and
 * skipped rather than raised.
 */
async function saveSupportingPdfs(
  app: FastifyInstance,
  bidId: string,
  supporting: InboundAttachment[],
  attachmentData: InboundAttachmentData[],
): Promise<void> {
  for (const att of supporting) {
    const data = attachmentData.find((a) => a.fileName === att.fileName);
    if (!data?.contentBase64) continue;

    const buffer = Buffer.from(data.contentBase64, "base64");
    if (!looksLikePdf(buffer)) continue;

    try {
      const key = newStorageKey();
      await savePdf(key, buffer);
      await db.insert(uploads).values({
        bidId,
        fileName: att.fileName,
        fileSize: buffer.length,
        storagePath: key,
        isPrimary: false,
      });
    } catch (err) {
      app.log.warn({ err, fileName: att.fileName }, "could not store supporting attachment");
    }
  }
}

export interface IngestResult {
  status: "created" | "ignored" | "duplicate" | "failed";
  classification?: string;
  bidId?: string;
  reason?: string;
}

/**
 * Detect, then (if it's an ITB) extract the PDF and land a draft bid.
 * Exported so tests can drive it without a webhook.
 */
export async function ingestInboundEmail(
  app: FastifyInstance,
  userId: string,
  email: InboundEmail,
  attachmentData: InboundAttachmentData[],
): Promise<IngestResult> {
  const detection = detectItb(email, { knownGcDomains: await knownGcDomains(userId) });

  // Record first: the audit row is the answer to "what happened to that
  // email?", and it must exist even if extraction later fails. The unique
  // index makes a provider retry a no-op.
  const [record] = await db
    .insert(inboundMessages)
    .values({
      userId,
      messageId: email.messageId,
      fromAddress: email.from,
      subject: email.subject,
      classification: detection.classification,
      score: detection.score,
      reasons: detection.reasons,
    })
    .onConflictDoNothing()
    .returning();

  if (!record) return { status: "duplicate", classification: detection.classification };

  if (detection.classification !== "itb") {
    return {
      status: "ignored",
      classification: detection.classification,
      reason: detection.reasons.join("; "),
    };
  }

  // Which PDF is the solicitation? This used to take pdfAttachments[0] —
  // whichever the mail client listed first. On real SAM.gov postings that is
  // routinely the drawing set, and extracting a drawing set produces a bid
  // whose scope, trade, and deadline are all confidently wrong.
  const choice = choosePdf(detection.pdfAttachments)!;
  if (choice.uncertain) {
    app.log.warn(
      { fileName: choice.primary.fileName, candidates: detection.pdfAttachments.length },
      "no attachment looked like a solicitation — extracting a best guess",
    );
  }

  const data = attachmentData.find((a) => a.fileName === choice.primary.fileName);
  if (!data?.contentBase64) {
    await db.update(inboundMessages).set({ error: "attachment had no content" })
      .where(eq(inboundMessages.id, record.id));
    return { status: "failed", reason: "attachment had no content" };
  }

  const buffer = Buffer.from(data.contentBase64, "base64");
  if (!looksLikePdf(buffer)) {
    await db.update(inboundMessages).set({ error: "attachment is not a PDF" })
      .where(eq(inboundMessages.id, record.id));
    return { status: "failed", reason: "attachment is not a PDF" };
  }

  try {
    const storageKey = newStorageKey();
    await savePdf(storageKey, buffer);

    const extraction = await extractFromPdf(buffer);

    const [bid] = await db
      .insert(bids)
      .values({
        userId,
        itbFileName: data.fileName,
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
      bidId: bid.id,
      fileName: data.fileName,
      fileSize: buffer.length,
      storagePath: storageKey,
      isPrimary: true,
    });

    // Keep the drawings, wage determination, and addenda. They're not what we
    // extract from, but they're part of the ITB the estimator has to bid, and
    // the email they arrived in isn't kept.
    await saveSupportingPdfs(app, bid.id, choice.supporting, attachmentData);

    await db.update(inboundMessages).set({ bidId: bid.id })
      .where(eq(inboundMessages.id, record.id));

    return { status: "created", classification: "itb", bidId: bid.id };
  } catch (err) {
    app.log.error({ err }, "inbound ingestion failed");
    await db
      .update(inboundMessages)
      .set({ error: err instanceof Error ? err.message : String(err) })
      .where(eq(inboundMessages.id, record.id));
    return { status: "failed", reason: "extraction failed" };
  }
}

/** Recent inbound activity for the signed-in user (audit + notification). */
export async function recentInbound(userId: string, limit = 50) {
  return db
    .select()
    .from(inboundMessages)
    .where(eq(inboundMessages.userId, userId))
    .orderBy(desc(inboundMessages.receivedAt))
    .limit(limit);
}

void costHistory;
