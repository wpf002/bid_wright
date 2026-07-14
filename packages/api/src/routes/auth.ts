import type { FastifyInstance } from "fastify";
import { db, users } from "@bidwright/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().optional(),
  primaryTrade: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (req, reply) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await db.select().from(users).where(eq(users.email, parsed.data.email));
    if (existing.length) return reply.status(409).send({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const [user] = await db.insert(users).values({
      email: parsed.data.email,
      passwordHash,
      companyName: parsed.data.companyName ?? null,
      primaryTrade: parsed.data.primaryTrade ?? null,
    }).returning();

    const token = app.jwt.sign({ userId: user.id, email: user.email }, { expiresIn: "15m" });
    return { token, user: { id: user.id, email: user.email, companyName: user.companyName } };
  });

  app.post("/login", async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));
    if (!user) return reply.status(401).send({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) return reply.status(401).send({ error: "Invalid credentials" });

    const token = app.jwt.sign({ userId: user.id, email: user.email }, { expiresIn: "15m" });
    return { token, user: { id: user.id, email: user.email, companyName: user.companyName } };
  });
}
