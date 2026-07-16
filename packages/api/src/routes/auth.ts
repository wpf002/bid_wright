import type { FastifyInstance } from "fastify";
import { db, users } from "@bidwright/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from "../auth/tokens";
import { requireAuth, currentUserId } from "../auth/middleware";

const ACCESS_TTL = "15m";

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

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

interface PublicUser {
  id: string;
  email: string;
  companyName: string | null;
}

function publicUser(u: { id: string; email: string; companyName: string | null }): PublicUser {
  return { id: u.id, email: u.email, companyName: u.companyName };
}

export async function authRoutes(app: FastifyInstance) {
  const signAccess = (userId: string, email: string) =>
    app.jwt.sign({ userId, email }, { expiresIn: ACCESS_TTL });

  app.post("/register", async (req, reply) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const email = parsed.data.email.toLowerCase();
    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length) return reply.status(409).send({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const [user] = await db.insert(users).values({
      email,
      passwordHash,
      companyName: parsed.data.companyName ?? null,
      primaryTrade: parsed.data.primaryTrade ?? null,
    }).returning();

    const refreshToken = await issueRefreshToken(user.id);
    return reply.status(201).send({
      token: signAccess(user.id, user.email),
      refreshToken,
      user: publicUser(user),
    });
  });

  app.post("/login", async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const email = parsed.data.email.toLowerCase();
    const [user] = await db.select().from(users).where(eq(users.email, email));
    // Compare against a dummy hash when the user is absent so response time
    // doesn't reveal whether the email exists.
    const hash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";
    const ok = await bcrypt.compare(parsed.data.password, hash);
    if (!user || !ok) return reply.status(401).send({ error: "Invalid credentials" });

    const refreshToken = await issueRefreshToken(user.id);
    return {
      token: signAccess(user.id, user.email),
      refreshToken,
      user: publicUser(user),
    };
  });

  /** Exchange a refresh token for a fresh access + refresh pair (rotation). */
  app.post("/refresh", async (req, reply) => {
    const parsed = RefreshSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const result = await rotateRefreshToken(parsed.data.refreshToken);
    if (!result.ok) {
      const status = result.reason === "reused" ? 403 : 401;
      const error = result.reason === "reused"
        ? "Refresh token reuse detected — all sessions revoked"
        : "Invalid refresh token";
      return reply.status(status).send({ error });
    }

    const [user] = await db.select().from(users).where(eq(users.id, result.userId));
    if (!user) return reply.status(401).send({ error: "Invalid refresh token" });

    return {
      token: signAccess(user.id, user.email),
      refreshToken: result.token,
      user: publicUser(user),
    };
  });

  app.post("/logout", async (req, reply) => {
    const parsed = RefreshSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    await revokeRefreshToken(parsed.data.refreshToken);
    return reply.status(204).send();
  });

  app.get("/me", { preHandler: requireAuth }, async (req, reply) => {
    const [user] = await db.select().from(users).where(eq(users.id, currentUserId(req)));
    if (!user) return reply.status(404).send({ error: "Not found" });
    return publicUser(user);
  });
}
