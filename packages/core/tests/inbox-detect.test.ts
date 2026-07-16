import { describe, it, expect } from "vitest";
import {
  detectItb, isPdf, itbClassifierPrompt, parseClassifierReply,
  ITB_THRESHOLD, type InboundEmail,
} from "../src/inbox/detect";
import {
  ITB_EMAILS, NON_ITB_EMAILS, INBOX_CORPUS, KNOWN_GC_DOMAINS,
} from "./fixtures/inbox-corpus";

const opts = { knownGcDomains: KNOWN_GC_DOMAINS };
const pdf = (n: string) => ({ fileName: n, contentType: "application/pdf", size: 1000 });

function email(p: Partial<InboundEmail> & { subject: string; from: string }): InboundEmail {
  return {
    messageId: "<x@y>", to: "u-a@inbox.bidwright.app", text: "", attachments: [],
    ...p,
  };
}

describe("corpus shape", () => {
  it("is a 100-email test set", () => {
    expect(INBOX_CORPUS).toHaveLength(100);
    expect(ITB_EMAILS.length + NON_ITB_EMAILS.length).toBe(100);
  });
  it("has unique message ids", () => {
    expect(new Set(INBOX_CORPUS.map((e) => e.messageId)).size).toBe(100);
  });
});

describe("EXIT CRITERION: zero false positives on non-ITB email", () => {
  it("classifies no non-ITB email as an ITB", () => {
    const falsePositives = NON_ITB_EMAILS.filter(
      (e) => detectItb(e, opts).classification === "itb",
    );
    // Name them, so a regression says which email broke and why.
    expect(
      falsePositives.map((e) => `${e.from} :: ${e.subject}`),
    ).toEqual([]);
  });

  it("does not even escalate most non-ITB email to the model", () => {
    const escalated = NON_ITB_EMAILS.filter(
      (e) => detectItb(e, opts).classification === "uncertain",
    );
    // Escalation is a cost and a latency hit; the cheap rules should settle
    // the overwhelming majority.
    expect(escalated.length).toBeLessThanOrEqual(5);
  });
});

describe("recall on real solicitations", () => {
  it("detects every ITB in the corpus without needing the model", () => {
    const missed = ITB_EMAILS.filter((e) => detectItb(e, opts).classification !== "itb");
    expect(missed.map((e) => e.subject)).toEqual([]);
  });

  it("still detects an ITB from a GC the user has never bid with", () => {
    const stranger = email({
      from: "estimating@brand-new-gc.com",
      subject: "Invitation to Bid — New Warehouse Electrical",
      text: "Scope of work attached. Bids due 9/9. Pre-bid walkthrough next week.",
      attachments: [pdf("itb.pdf")],
    });
    expect(detectItb(stranger, opts).classification).toBe("itb");
  });
});

describe("the PDF requirement", () => {
  it("rejects a perfect-looking ITB with no attachment — nothing to extract", () => {
    const res = detectItb(
      email({
        from: "estimating@turnerridge.com",
        subject: "Invitation to Bid — Northside Elementary",
        text: "Scope of work, bids due 8/12, pre-bid walkthrough.",
        attachments: [],
      }),
      opts,
    );
    expect(res.classification).toBe("not_itb");
    expect(res.reasons.join(" ")).toMatch(/no PDF attachment/i);
  });

  it("ignores non-PDF attachments when deciding", () => {
    const res = detectItb(
      email({
        from: "estimating@turnerridge.com",
        subject: "Invitation to Bid — Northside",
        text: "Scope of work. Bids due.",
        attachments: [{ fileName: "form.xlsx", contentType: "application/vnd.ms-excel", size: 10 }],
      }),
      opts,
    );
    expect(res.classification).toBe("not_itb");
  });
});

describe("negative signals outrank positives", () => {
  it("rejects an invoice from a known GC that mentions the bid", () => {
    const res = detectItb(
      email({
        from: "ap@turnerridge.com",
        subject: "Invoice for the Northside bid package",
        text: "Invoice attached. Payment due. Scope of work completed per your bid.",
        attachments: [pdf("invoice.pdf")],
      }),
      opts,
    );
    expect(res.classification).not.toBe("itb");
  });

  it("rejects an award notice that quotes solicitation language", () => {
    const res = detectItb(
      email({
        from: "estimating@austincommercial.com",
        subject: "Invitation to Bid — Concourse D — BID RESULTS",
        text: "Bid results attached. We regret to inform you your bid was not selected.",
        attachments: [pdf("results.pdf")],
      }),
      opts,
    );
    expect(res.classification).not.toBe("itb");
  });

  it("rejects a bid-board digest newsletter", () => {
    const res = detectItb(
      email({
        from: "noreply@buildingconnected.com",
        subject: "Invitation to Bid — 12 new opportunities",
        text: "Your weekly bidding opportunities digest. Scope of work summaries. Unsubscribe from this list.",
        attachments: [pdf("digest.pdf")],
      }),
      opts,
    );
    expect(res.classification).not.toBe("itb");
  });
});

describe("known-GC signal", () => {
  it("scores a known GC higher than a stranger on identical mail", () => {
    const body = {
      subject: "Bid package attached",
      text: "Please see the attached bid documents. Scope of work included.",
      attachments: [pdf("x.pdf")],
    };
    const known = detectItb(email({ from: "a@turnerridge.com", ...body }), opts).score;
    const stranger = detectItb(email({ from: "a@unknown-co.com", ...body }), opts).score;
    expect(known).toBeGreaterThan(stranger);
  });

  it("works with no history at all", () => {
    const res = detectItb(
      email({
        from: "estimating@somegc.com",
        subject: "Invitation to Bid — Project X",
        text: "Scope of work attached. Bids due 9/1.",
        attachments: [pdf("itb.pdf")],
      }),
      {},
    );
    expect(res.classification).toBe("itb");
  });
});

describe("phrase matching", () => {
  it("does not fire on a word merely containing a keyword", () => {
    // "tender" inside "tendered" / "itb" inside a random token.
    const res = detectItb(
      email({
        from: "friend@example.com",
        subject: "He tendered his resignation",
        text: "Nothing to do with construction.",
        attachments: [pdf("letter.pdf")],
      }),
      opts,
    );
    expect(res.classification).toBe("not_itb");
  });
});

describe("isPdf", () => {
  it("detects by content type or extension", () => {
    expect(isPdf({ fileName: "a.pdf", contentType: "application/octet-stream", size: 1 })).toBe(true);
    expect(isPdf({ fileName: "a", contentType: "application/pdf", size: 1 })).toBe(true);
    expect(isPdf({ fileName: "a.PDF", contentType: "x", size: 1 })).toBe(true);
    expect(isPdf({ fileName: "a.docx", contentType: "application/msword", size: 1 })).toBe(false);
  });
});

describe("model fallback for the uncertain band", () => {
  it("builds a prompt that defines what an ITB is not", () => {
    const p = itbClassifierPrompt(ITB_EMAILS[0]);
    expect(p).toContain(ITB_EMAILS[0].subject);
    expect(p).toMatch(/invoice/i);
    expect(p).toMatch(/exactly one word/i);
  });

  it("reads a clean reply", () => {
    expect(parseClassifierReply("ITB")).toBe("itb");
    expect(parseClassifierReply("OTHER")).toBe("not_itb");
    expect(parseClassifierReply("itb\n")).toBe("itb");
  });

  it("treats anything unclear as not an ITB — precision first", () => {
    expect(parseClassifierReply("I'm not sure, possibly ITB")).toBe("not_itb");
    expect(parseClassifierReply("")).toBe("not_itb");
  });
});

describe("scoring is explainable", () => {
  it("returns the reasons behind a decision", () => {
    const res = detectItb(ITB_EMAILS[0], opts);
    expect(res.score).toBeGreaterThanOrEqual(ITB_THRESHOLD);
    expect(res.reasons.join(" ")).toMatch(/solicitation/i);
    expect(res.pdfAttachments.length).toBeGreaterThan(0);
  });
});
