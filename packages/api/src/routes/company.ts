import type { FastifyInstance } from "fastify";
import { db, users } from "@bidwright/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, currentUserId } from "../auth/middleware";
import { saveFile, readFile, fileExists, deleteFile, newStorageKey, sniffImageType } from "../storage/files";

/**
 * Company profile — what appears on an exported proposal.
 *
 * The roadmap's bar for Phase 7 is that the export "looks better than what the
 * sub was producing in Excel", and the letterhead is most of that.
 */

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const ProfileSchema = z.object({
  companyName: z.string().max(120).nullable().optional(),
  // Hex only: this value is interpolated into generated documents, so keeping
  // it to a strict shape avoids passing arbitrary strings to the PDF writer.
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #d97706")
    .nullable()
    .optional(),
  companyAddress: z.string().max(300).nullable().optional(),
  companyPhone: z.string().max(60).nullable().optional(),
  companyEmail: z.string().email().max(200).nullable().optional().or(z.literal("")),
  companyLicense: z.string().max(120).nullable().optional(),
  proposalTerms: z.string().max(4000).nullable().optional(),
});

export interface CompanyProfile {
  companyName: string | null;
  brandColor: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyLicense: string | null;
  proposalTerms: string | null;
  hasLogo: boolean;
}

function toProfile(u: typeof users.$inferSelect): CompanyProfile {
  return {
    companyName: u.companyName,
    brandColor: u.brandColor,
    companyAddress: u.companyAddress,
    companyPhone: u.companyPhone,
    companyEmail: u.companyEmail,
    companyLicense: u.companyLicense,
    proposalTerms: u.proposalTerms,
    hasLogo: Boolean(u.logoStoragePath),
  };
}

export async function companyRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/profile", async (req, reply) => {
    const [user] = await db.select().from(users).where(eq(users.id, currentUserId(req)));
    if (!user) return reply.status(404).send({ error: "Not found" });
    return toProfile(user);
  });

  app.patch("/profile", async (req, reply) => {
    const parsed = ProfileSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const patch = { ...parsed.data };
    // An empty email field means "clear it", not "store an empty string".
    if (patch.companyEmail === "") patch.companyEmail = null;

    const [updated] = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, currentUserId(req)))
      .returning();
    return toProfile(updated);
  });

  app.post("/logo", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    const buffer = await data.toBuffer();
    if (buffer.length > MAX_LOGO_BYTES) {
      return reply.status(400).send({ error: "Logo must be under 2 MB." });
    }

    // Sniff the bytes rather than trusting the declared type: we serve this
    // back with an image content-type, so storing arbitrary bytes here would
    // be a way to have us host whatever the uploader liked.
    const type = sniffImageType(buffer);
    if (!type) return reply.status(400).send({ error: "Logo must be a PNG or JPEG." });

    const userId = currentUserId(req);
    const [existing] = await db.select().from(users).where(eq(users.id, userId));

    const key = newStorageKey(type === "image/png" ? "png" : "jpg");
    await saveFile(key, buffer);
    await db.update(users).set({ logoStoragePath: key }).where(eq(users.id, userId));

    // Best-effort cleanup of the replaced file; a leftover must never fail the
    // upload the user actually asked for.
    if (existing?.logoStoragePath) {
      await deleteFile(existing.logoStoragePath).catch(() => undefined);
    }

    return reply.status(201).send({ hasLogo: true });
  });

  app.get("/logo", async (req, reply) => {
    const [user] = await db.select().from(users).where(eq(users.id, currentUserId(req)));
    const key = user?.logoStoragePath;
    if (!key || !(await fileExists(key))) return reply.status(404).send({ error: "Not found" });

    const bytes = await readFile(key);
    const type = sniffImageType(bytes) ?? "application/octet-stream";
    return reply
      .header("content-type", type)
      .header("cache-control", "private, max-age=300")
      .send(bytes);
  });

  app.delete("/logo", async (req, reply) => {
    const userId = currentUserId(req);
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (user?.logoStoragePath) {
      await deleteFile(user.logoStoragePath).catch(() => undefined);
      await db.update(users).set({ logoStoragePath: null }).where(eq(users.id, userId));
    }
    return reply.status(204).send();
  });
}
