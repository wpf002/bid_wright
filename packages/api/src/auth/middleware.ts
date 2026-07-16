import type { FastifyRequest, FastifyReply } from "fastify";

export interface AccessTokenPayload {
  userId: string;
  email: string;
}

declare module "fastify" {
  interface FastifyRequest {
    /** Set by requireAuth once the access token is verified. */
    currentUser?: AccessTokenPayload;
  }
}

/**
 * preHandler that rejects unauthenticated requests. Every bid route uses this —
 * without it the API hands any caller every user's bids.
 */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const payload = await req.jwtVerify<AccessTokenPayload>();
    req.currentUser = { userId: payload.userId, email: payload.email };
  } catch {
    return reply.status(401).send({ error: "Unauthorized" });
  }
}

/** The authenticated user, or throw — for handlers already behind requireAuth. */
export function currentUserId(req: FastifyRequest): string {
  if (!req.currentUser) throw new Error("currentUserId called on an unauthenticated request");
  return req.currentUser.userId;
}
