import { randomBytes, createHash } from "node:crypto";
import { db, refreshTokens } from "@bidwright/db";
import { eq, and, lt, isNull } from "drizzle-orm";

/**
 * Refresh-token rotation.
 *
 * Tokens are random 32-byte secrets handed to the client; we only ever store a
 * SHA-256 hash, so a database leak can't be replayed. Each use rotates: the old
 * token is revoked and stamped with the token that replaced it. Presenting an
 * already-rotated token means it leaked, so we revoke the whole family.
 */

const REFRESH_TTL_DAYS = 7;

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshExpiryDate(from = new Date()): Date {
  return new Date(from.getTime() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Issue a brand-new refresh token for a user (login / register). */
export async function issueRefreshToken(userId: string): Promise<string> {
  const token = generateRefreshToken();
  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: refreshExpiryDate(),
  });
  return token;
}

export type RotateResult =
  | { ok: true; userId: string; token: string }
  | { ok: false; reason: "not_found" | "expired" | "revoked" | "reused" };

/**
 * Exchange a refresh token for a new one. Returns the new token and the owning
 * user, or a reason the exchange was refused.
 */
export async function rotateRefreshToken(presented: string): Promise<RotateResult> {
  const tokenHash = hashToken(presented);
  const [row] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));

  if (!row) return { ok: false, reason: "not_found" };

  // A token that was already rotated is being replayed — treat as theft and
  // revoke every live token for this user.
  if (row.replacedBy) {
    await revokeAllForUser(row.userId);
    return { ok: false, reason: "reused" };
  }
  if (row.revokedAt) return { ok: false, reason: "revoked" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };

  const next = generateRefreshToken();
  const nextHash = hashToken(next);

  await db.insert(refreshTokens).values({
    userId: row.userId,
    tokenHash: nextHash,
    expiresAt: refreshExpiryDate(),
  });
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date(), replacedBy: nextHash })
    .where(eq(refreshTokens.id, row.id));

  return { ok: true, userId: row.userId, token: next };
}

/** Revoke a single token (logout). Idempotent. */
export async function revokeRefreshToken(presented: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, hashToken(presented)), isNull(refreshTokens.revokedAt)));
}

/** Revoke every live token for a user (logout-everywhere / reuse detected). */
export async function revokeAllForUser(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

/** Housekeeping: drop expired rows. */
export async function purgeExpiredTokens(now = new Date()): Promise<void> {
  await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, now));
}
