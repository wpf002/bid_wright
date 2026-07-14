import type { FastifyInstance } from "fastify";
import { db, bids } from "@bidwright/db";
import { eq, desc } from "drizzle-orm";

export async function bidRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return db.select().from(bids).orderBy(desc(bids.createdAt));
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const [row] = await db.select().from(bids).where(eq(bids.id, req.params.id));
    if (!row) return reply.status(404).send({ error: "Not found" });
    return row;
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/:id",
    async (req, reply) => {
      const [updated] = await db.update(bids)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(bids.id, req.params.id))
        .returning();
      if (!updated) return reply.status(404).send({ error: "Not found" });
      return updated;
    },
  );

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    await db.delete(bids).where(eq(bids.id, req.params.id));
    return reply.status(204).send();
  });
}
