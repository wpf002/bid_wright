import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { isDatabaseReachable, uniqueEmail, TEST_DATABASE_URL } from "./helpers/db";

// The db client reads DATABASE_URL at import time, so set it before importing.
process.env.DATABASE_URL ??= TEST_DATABASE_URL;

const dbUp = await isDatabaseReachable();
const describeDb = dbUp ? describe : describe.skip;

if (!dbUp) {
  console.warn(
    `\n[api tests] Skipping integration tests — no Postgres at ${TEST_DATABASE_URL}.\n` +
      `Run \`docker compose up -d && npm run db:migrate\` to enable them.\n`,
  );
}

describeDb("auth flow (real Postgres)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { buildApp } = await import("../src/app");
    app = await buildApp({ jwtSecret: "test-secret-min-32-chars-1234567890" });
  });

  afterAll(async () => {
    await app?.close();
  });

  async function register(email = uniqueEmail()) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email, password: "correct-horse-battery", companyName: "Foti Electric" },
    });
    return { res, email };
  }

  describe("register", () => {
    it("creates a user and returns an access + refresh pair", async () => {
      const { res, email } = await register();
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.token).toBeTruthy();
      expect(body.refreshToken).toBeTruthy();
      expect(body.user.email).toBe(email);
      expect(body.user.companyName).toBe("Foti Electric");
    });

    it("never returns the password hash", async () => {
      const { res } = await register();
      expect(JSON.stringify(res.json())).not.toMatch(/passwordHash|\$2[aby]\$/);
    });

    it("rejects a duplicate email", async () => {
      const email = uniqueEmail();
      await register(email);
      const { res } = await register(email);
      expect(res.statusCode).toBe(409);
    });

    it("rejects a short password", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: uniqueEmail(), password: "short" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects a malformed email", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: "not-an-email", password: "correct-horse-battery" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("login", () => {
    it("succeeds with correct credentials", async () => {
      const { email } = await register();
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "correct-horse-battery" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().refreshToken).toBeTruthy();
    });

    it("is case-insensitive on email", async () => {
      const email = uniqueEmail("MixedCase");
      await register(email);
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: email.toUpperCase(), password: "correct-horse-battery" },
      });
      expect(res.statusCode).toBe(200);
    });

    it("rejects a wrong password", async () => {
      const { email } = await register();
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "wrong-password" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("rejects an unknown user with the same 401 (no user enumeration)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: uniqueEmail("ghost"), password: "correct-horse-battery" },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("Invalid credentials");
    });
  });

  describe("refresh rotation", () => {
    it("exchanges a refresh token for a new pair", async () => {
      const { res: reg } = await register();
      const original = reg.json().refreshToken;

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        payload: { refreshToken: original },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.token).toBeTruthy();
      // rotation: the new refresh token must differ from the one presented
      expect(body.refreshToken).not.toBe(original);
    });

    it("invalidates the old token once rotated", async () => {
      const { res: reg } = await register();
      const original = reg.json().refreshToken;
      await app.inject({ method: "POST", url: "/api/auth/refresh", payload: { refreshToken: original } });

      // presenting the original a second time is reuse -> 403
      const replay = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        payload: { refreshToken: original },
      });
      expect(replay.statusCode).toBe(403);
      expect(replay.json().error).toMatch(/reuse detected/i);
    });

    it("revokes the whole family when reuse is detected", async () => {
      const { res: reg } = await register();
      const first = reg.json().refreshToken;
      const second = (
        await app.inject({ method: "POST", url: "/api/auth/refresh", payload: { refreshToken: first } })
      ).json().refreshToken;

      // replay the already-rotated token — should nuke every live token
      await app.inject({ method: "POST", url: "/api/auth/refresh", payload: { refreshToken: first } });

      // the legitimately-issued second token is now dead too
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        payload: { refreshToken: second },
      });
      expect(res.statusCode).toBe(401);
    });

    it("rejects a garbage refresh token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        payload: { refreshToken: "not-a-real-token" },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("logout", () => {
    it("revokes the refresh token", async () => {
      const { res: reg } = await register();
      const refreshToken = reg.json().refreshToken;

      const out = await app.inject({ method: "POST", url: "/api/auth/logout", payload: { refreshToken } });
      expect(out.statusCode).toBe(204);

      const res = await app.inject({ method: "POST", url: "/api/auth/refresh", payload: { refreshToken } });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("/me", () => {
    it("returns the current user with a valid access token", async () => {
      const { res: reg, email } = await register();
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${reg.json().token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().email).toBe(email);
    });

    it("401s without a token", async () => {
      const res = await app.inject({ method: "GET", url: "/api/auth/me" });
      expect(res.statusCode).toBe(401);
    });

    it("401s with a garbage token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: "Bearer garbage.token.here" },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
