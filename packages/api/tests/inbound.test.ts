import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { isDatabaseReachable, uniqueEmail, TEST_DATABASE_URL } from "./helpers/db";
import {
  parseInboundToken, normalizePostmark, verifyInboundSecret, generateInboundToken,
  inboundAddress, deliveredTo,
} from "../src/inbox/postmark";

/**
 * Stub only the model call. detectItb and choosePdf stay real — which PDF
 * ingestion picks is exactly what these tests are here to check, so mocking the
 * chooser would leave the bug untested.
 */
vi.mock("@bidwright/core", async () => {
  const actual = await vi.importActual<typeof import("@bidwright/core")>("@bidwright/core");
  return {
    ...actual,
    extractFromPdf: vi.fn(async () => ({
      metadata: {
        projectName: "Electrical Upgrade",
        projectAddress: null, owner: "NOAA", generalContractor: null,
        bidDeadline: null, rfiDeadline: null, walkthroughDate: null,
        contactName: null, contactEmail: null, contactPhone: null,
      },
      scope: [], inclusions: [], exclusions: [], compliance: [],
      primaryTrade: "electrical" as const,
      warnings: [], rawTextPreview: "", pageCount: 1,
    })),
  };
});

/** Smallest thing that satisfies looksLikePdf; extraction is stubbed anyway. */
const PDF_B64 = Buffer.from("%PDF-1.4\n%%EOF\n").toString("base64");

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

  /**
   * A multi-attachment ITB, mirroring SAM.gov posting 08c4a2b7: the
   * solicitation is listed third, behind two technical exhibits.
   */
  const multiAttachment = (messageId: string) => ({
    MessageID: messageId,
    FromFull: { Email: "contracting@noaa.gov" },
    OriginalRecipient: inboundAddress(token, "inbox.bidwright.app"),
    Subject: "Invitation to Bid — Electrical Upgrade",
    TextBody: "Solicitation and technical exhibits attached. Bids due 9/9.",
    Attachments: [
      { Name: "3_Technical_Exhibit_145027-26-0030.pdf", ContentType: "application/pdf", ContentLength: 900, Content: PDF_B64 },
      { Name: "Attachment 1. Drawings_1240LU26Q0105.pdf", ContentType: "application/pdf", ContentLength: 900, Content: PDF_B64 },
      { Name: "Sol_1305M326Q0317.pdf", ContentType: "application/pdf", ContentLength: 900, Content: PDF_B64 },
      { Name: "Wage Determination CA20260018.pdf", ContentType: "application/pdf", ContentLength: 900, Content: PDF_B64 },
    ],
  });

  it("extracts the solicitation, not whichever PDF was attached first", async () => {
    // The old code took pdfAttachments[0] — here, a technical exhibit.
    const res = await post(multiAttachment("<multi-1@noaa.gov>"));
    expect(res.json().status).toBe("created");

    const auth = { authorization: `Bearer ${(await login()).token}` };
    const bid = (await app.inject({
      method: "GET",
      url: `/api/bids/${res.json().bidId}`,
      headers: auth,
    })).json();

    expect(bid.itbFileName).toBe("Sol_1305M326Q0317.pdf");
  });

  it("keeps the drawings and wage determination rather than dropping them", async () => {
    const res = await post(multiAttachment("<multi-2@noaa.gov>"));
    const bidId = res.json().bidId;

    const { db, uploads } = await import("@bidwright/db");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(uploads).where(eq(uploads.bidId, bidId));

    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.isPrimary).map((r) => r.fileName)).toEqual(["Sol_1305M326Q0317.pdf"]);
    expect(rows.filter((r) => !r.isPrimary).map((r) => r.fileName).sort()).toEqual([
      "3_Technical_Exhibit_145027-26-0030.pdf",
      "Attachment 1. Drawings_1240LU26Q0105.pdf",
      "Wage Determination CA20260018.pdf",
    ]);
  });

  it("serves the solicitation from /file, not a supporting attachment", async () => {
    // Four uploads now share this bid; the provenance pane must still get the
    // document the scope was extracted from.
    const res = await post(multiAttachment("<multi-3@noaa.gov>"));
    const auth = { authorization: `Bearer ${(await login()).token}` };

    const file = await app.inject({
      method: "GET",
      url: `/api/uploads/${res.json().bidId}/file`,
      headers: auth,
    });

    expect(file.statusCode).toBe(200);
    expect(file.headers["content-disposition"]).toContain("Sol_1305M326Q0317.pdf");
  });

  it("accepts an ITB email the size a real one actually is", async () => {
    // Fastify's default 1 MB JSON body rejected every real ITB with a 413
    // before any ingestion code ran. Attachments arrive base64-encoded, and
    // base64 inflates by a third, so a 2 MB PDF is a ~2.7 MB payload.
    const big = Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.alloc(2 * 1024 * 1024, 0x41),
    ]).toString("base64");

    const res = await post({
      MessageID: "<realistic-size@noaa.gov>",
      FromFull: { Email: "contracting@noaa.gov" },
      OriginalRecipient: inboundAddress(token, "inbox.bidwright.app"),
      Subject: "Invitation to Bid — Electrical Upgrade",
      TextBody: "Solicitation attached. Bids due 9/9.",
      Attachments: [
        { Name: "Sol_1305M326Q0317.pdf", ContentType: "application/pdf", ContentLength: 2_097_161, Content: big },
      ],
    });

    expect(res.statusCode).not.toBe(413);
    expect(res.json().status).toBe("created");
  });

  it("skips a scanned drawing set instead of writing it to disk forever", async () => {
    // 12 MB of "scan" — over the 10 MB per-file cap for supporting material we
    // never read. The solicitation is still extracted and kept.
    const scan = Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.alloc(12 * 1024 * 1024, 0x42),
    ]).toString("base64");

    const res = await post({
      MessageID: "<huge-scan@noaa.gov>",
      FromFull: { Email: "contracting@noaa.gov" },
      OriginalRecipient: inboundAddress(token, "inbox.bidwright.app"),
      Subject: "Invitation to Bid — Electrical Upgrade",
      TextBody: "Solicitation and exhibits attached. Bids due 9/9.",
      Attachments: [
        { Name: "Sol_1305M326Q0317.pdf", ContentType: "application/pdf", ContentLength: 900, Content: PDF_B64 },
        { Name: "SOW_Pictures_scanned.pdf", ContentType: "application/pdf", ContentLength: 12_582_921, Content: scan },
        { Name: "Addendum 1.pdf", ContentType: "application/pdf", ContentLength: 900, Content: PDF_B64 },
      ],
    });
    expect(res.json().status).toBe("created");

    const { db, uploads } = await import("@bidwright/db");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(uploads).where(eq(uploads.bidId, res.json().bidId));

    // The scan is absent; the solicitation and the small addendum are kept.
    expect(rows.map((r) => r.fileName).sort()).toEqual([
      "Addendum 1.pdf",
      "Sol_1305M326Q0317.pdf",
    ]);
  });

  it("says in the activity log why an attachment wasn't kept", async () => {
    // Nothing in the UI lists a bid's attachments, so a silent skip would be
    // invisible — the inbox log is where the user can see it.
    const scan = Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.alloc(12 * 1024 * 1024, 0x42),
    ]).toString("base64");

    await post({
      MessageID: "<skip-note@noaa.gov>",
      FromFull: { Email: "contracting@noaa.gov" },
      OriginalRecipient: inboundAddress(token, "inbox.bidwright.app"),
      Subject: "Invitation to Bid — Electrical Upgrade",
      TextBody: "Solicitation and exhibits attached. Bids due 9/9.",
      Attachments: [
        { Name: "Sol_1305M326Q0317.pdf", ContentType: "application/pdf", ContentLength: 900, Content: PDF_B64 },
        { Name: "drawings_scanned.pdf", ContentType: "application/pdf", ContentLength: 12_582_921, Content: scan },
      ],
    });

    const messages = (await app.inject({
      method: "GET",
      url: "/api/inbox/messages",
      headers: { authorization: `Bearer ${(await login()).token}` },
    })).json();

    const row = messages.find((m: { messageId: string }) => m.messageId === "<skip-note@noaa.gov>");
    expect(JSON.stringify(row.reasons)).toMatch(/drawings_scanned\.pdf/);
    expect(JSON.stringify(row.reasons)).toMatch(/too large/i);
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
