import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { isDatabaseReachable, uniqueEmail, TEST_DATABASE_URL } from "./helpers/db";
import {
  parseInboundToken, normalizePostmark, verifyInboundSecret, generateInboundToken,
  inboundAddress, deliveredTo,
} from "../src/inbox/postmark";

process.env.DATABASE_URL ??= TEST_DATABASE_URL;
process.env.INBOUND_WEBHOOK_SECRET ??= "test-inbound-secret";

const dbUp = await isDatabaseReachable();
const describeDb = dbUp ? describe : describe.skip;

// ---- pure adapter tests (no DB) -------------------------------------------

describe("parseInboundToken", () => {
  it("reads the canonical u-<token> form", () => {
    expect(parseInboundToken("u-abc123def456@inbox.bidwright.app")).toBe("abc123def456");
  });
  it("accepts plus-addressing as a fallback", () => {
    expect(parseInboundToken("inbox+abc123def456@bidwright.app")).toBe("abc123def456");
  });
  it("is case-insensitive", () => {
    expect(parseInboundToken("U-ABC123DEF456@INBOX.BIDWRIGHT.APP")).toBe("abc123def456");
  });
  it("rejects anything else", () => {
    expect(parseInboundToken("hello@bidwright.app")).toBeNull();
    expect(parseInboundToken("u-short@bidwright.app")).toBeNull();
    expect(parseInboundToken("")).toBeNull();
  });
});

describe("deliveredTo", () => {
  it("prefers the envelope recipient over the To: header", () => {
    // Auto-forwarded mail keeps the user's own address in To:; only the
    // envelope carries the address we route on.
    expect(
      deliveredTo({
        To: "estimator@fotielectric.com",
        OriginalRecipient: "u-abc123def456@inbox.bidwright.app",
      }),
    ).toBe("u-abc123def456@inbox.bidwright.app");
  });
  it("falls back to ToFull then To", () => {
    expect(deliveredTo({ ToFull: [{ Email: "u-x@y.com" }], To: "other@y.com" })).toBe("u-x@y.com");
    expect(deliveredTo({ To: "only@y.com" })).toBe("only@y.com");
  });
});

describe("verifyInboundSecret", () => {
  it("accepts the right secret and rejects the wrong one", () => {
    expect(verifyInboundSecret("s3cret", "s3cret")).toBe(true);
    expect(verifyInboundSecret("wrong", "s3cret")).toBe(false);
    expect(verifyInboundSecret(undefined, "s3cret")).toBe(false);
    expect(verifyInboundSecret("", "s3cret")).toBe(false);
  });
  it("refuses to run unauthenticated rather than defaulting open", () => {
    // Anyone who can POST the webhook can put bids on a user's board.
    expect(() => verifyInboundSecret("anything", undefined)).toThrow(/refusing/i);
  });
});

describe("generateInboundToken / inboundAddress", () => {
  it("mints unguessable, unique tokens", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateInboundToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(t).toMatch(/^[a-f0-9]{24}$/);
  });
  it("builds a routable address that parses back", () => {
    const t = generateInboundToken();
    expect(parseInboundToken(inboundAddress(t, "inbox.example.com"))).toBe(t);
  });
});

describe("normalizePostmark", () => {
  const payload = {
    MessageID: "abc-123",
    FromFull: { Email: "malvarez@turnerridge.com", Name: "Maria Alvarez" },
    OriginalRecipient: "u-abc123def456@inbox.bidwright.app",
    Subject: "Invitation to Bid",
    TextBody: "Scope of work attached.",
    Attachments: [
      { Name: "itb.pdf", ContentType: "application/pdf", ContentLength: 1234, Content: "JVBERi0=" },
    ],
  };

  it("normalizes into the detection shape", () => {
    const { email, attachmentData } = normalizePostmark(payload);
    expect(email.messageId).toBe("abc-123");
    expect(email.from).toBe("malvarez@turnerridge.com");
    expect(email.to).toBe("u-abc123def456@inbox.bidwright.app");
    expect(email.attachments).toEqual([
      { fileName: "itb.pdf", contentType: "application/pdf", size: 1234 },
    ]);
    expect(attachmentData[0].contentBase64).toBe("JVBERi0=");
  });

  it("keeps base64 content out of the detection shape", () => {
    const { email } = normalizePostmark(payload);
    expect(JSON.stringify(email)).not.toContain("JVBERi0=");
  });

  it("survives a sparse payload", () => {
    const { email } = normalizePostmark({});
    expect(email.messageId).toMatch(/^generated-/);
    expect(email.subject).toBe("");
    expect(email.attachments).toEqual([]);
  });

  it("gives id-less messages distinct ids rather than colliding them", () => {
    const a = normalizePostmark({}).email.messageId;
    const b = normalizePostmark({}).email.messageId;
    expect(a).not.toBe(b);
  });
});

// ---- webhook + ingestion (real Postgres) ----------------------------------

describeDb("inbound webhook (real Postgres)", () => {
  let app: FastifyInstance;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    const { buildApp } = await import("../src/app");
    app = await buildApp({ jwtSecret: "test-secret-min-32-chars-1234567890" });

    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: uniqueEmail(), password: "correct-horse-battery" },
    });
    const body = reg.json();
    userId = body.user.id;

    const addr = await app.inject({
      method: "GET",
      url: "/api/inbox/address",
      headers: { authorization: `Bearer ${body.token}` },
    });
    token = parseInboundToken(addr.json().address)!;
  });

  afterAll(async () => {
    await app?.close();
  });

  const post = (payload: unknown, secret = process.env.INBOUND_WEBHOOK_SECRET) =>
    app.inject({ method: "POST", url: `/api/inbound/postmark?secret=${secret}`, payload });

  const nonItb = (messageId: string) => ({
    MessageID: messageId,
    FromFull: { Email: "ap@turnerridge.com" },
    OriginalRecipient: inboundAddress(token, "inbox.bidwright.app"),
    Subject: "Invoice 44821 — Northside Elementary",
    TextBody: "Please find attached invoice 44821. Payment due in 30 days.",
    Attachments: [
      { Name: "invoice.pdf", ContentType: "application/pdf", ContentLength: 10, Content: "JVBERi0=" },
    ],
  });

  it("rejects a request with no secret", async () => {
    const res = await app.inject({ method: "POST", url: "/api/inbound/postmark", payload: nonItb("x") });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a wrong secret", async () => {
    const res = await post(nonItb("x"), "not-the-secret");
    expect(res.statusCode).toBe(401);
  });

  it("ignores mail to an address with no token", async () => {
    const res = await post({ ...nonItb("no-token"), OriginalRecipient: "hello@bidwright.app" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ignored");
  });

  it("ignores mail for an unknown token", async () => {
    const res = await post({
      ...nonItb("unknown"),
      OriginalRecipient: "u-deadbeefdeadbeefdeadbeef@inbox.bidwright.app",
    });
    expect(res.json().status).toBe("ignored");
    expect(res.json().reason).toMatch(/unknown address/i);
  });

  it("records a non-ITB without creating a bid", async () => {
    const res = await post(nonItb("<invoice-1@t.com>"));
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ignored");
    expect(body.classification).toBe("not_itb");

    const messages = (await app.inject({
      method: "GET",
      url: "/api/inbox/messages",
      headers: { authorization: `Bearer ${(await login()).token}` },
    })).json();
    const row = messages.find((m: { messageId: string }) => m.messageId === "<invoice-1@t.com>");
    expect(row).toBeDefined();
    expect(row.bidId).toBeNull();
    // The audit row explains itself.
    expect(JSON.stringify(row.reasons)).toMatch(/invoice/i);
  });

  it("is idempotent — a provider retry does not duplicate", async () => {
    await post(nonItb("<retry-me@t.com>"));
    const second = await post(nonItb("<retry-me@t.com>"));
    expect(second.json().status).toBe("duplicate");
  });

  it("answers 200 for mail it ignores, so the provider stops retrying", async () => {
    const res = await post(nonItb("<ignored-2@t.com>"));
    expect(res.statusCode).toBe(200);
  });

  it("rejects an ITB whose attachment isn't really a PDF", async () => {
    const res = await post({
      MessageID: "<fake-pdf@t.com>",
      FromFull: { Email: "estimating@newgc.com" },
      OriginalRecipient: inboundAddress(token, "inbox.bidwright.app"),
      Subject: "Invitation to Bid — Test Project",
      TextBody: "Scope of work attached. Bids due 9/9.",
      Attachments: [
        // Declares PDF, contains a ZIP — detection accepts, ingestion must not.
        { Name: "itb.pdf", ContentType: "application/pdf", ContentLength: 10, Content: "UEsDBAo=" },
      ],
    });
    expect(res.json().status).toBe("failed");
    expect(res.json().reason).toMatch(/not a PDF/i);
  });

  async function login() {
    const [user] = await (await import("@bidwright/db")).db
      .select()
      .from((await import("@bidwright/db")).users)
      .where(
        (await import("drizzle-orm")).eq((await import("@bidwright/db")).users.id, userId),
      );
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: user.email, password: "correct-horse-battery" },
    });
    return res.json();
  }
});
