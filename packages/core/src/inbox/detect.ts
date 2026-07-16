/**
 * Deciding whether an inbound email is an Invitation to Bid.
 *
 * Tuned for precision, not recall. A missed ITB costs the estimator one manual
 * upload; a false positive puts a junk bid on their board and teaches them not
 * to trust the feature. So the bar is deliberately high, negatives outrank
 * positives, and anything genuinely ambiguous is escalated rather than guessed.
 */

export interface InboundAttachment {
  fileName: string;
  contentType: string;
  size: number;
}

/** A provider-agnostic inbound email. Adapters normalize into this. */
export interface InboundEmail {
  messageId: string;
  from: string;
  fromName?: string | null;
  to: string;
  subject: string;
  text: string;
  html?: string | null;
  attachments: InboundAttachment[];
  receivedAt?: string;
}

export type Classification = "itb" | "not_itb" | "uncertain";

export interface DetectionResult {
  classification: Classification;
  score: number;
  /** Human-readable signals, surfaced in the audit log so a miss is debuggable. */
  reasons: string[];
  pdfAttachments: InboundAttachment[];
}

/** Phrases that essentially only appear in bid solicitations. */
const STRONG_SUBJECT = [
  "invitation to bid", "invite to bid", "invitation for bid", "bid invitation",
  "itb", "request for quote", "request for quotation", "rfq", "request for proposal",
  "bid request", "bid package", "bid opportunity", "bidding opportunity",
  "bid solicitation", "notice to bidders", "call for bids", "tender",
];

/** Supporting phrases — real, but too generic to carry a decision alone. */
const BODY_SIGNALS = [
  "scope of work", "bid due", "bids due", "due date for bids", "bid date",
  "pre-bid", "prebid", "pre bid", "walkthrough", "walk-through", "job walk",
  "plans and specs", "plans & specs", "drawings and specifications",
  "addendum", "addenda", "plan room", "bid documents", "bid bond",
  "please provide a quote", "please quote", "submit your bid", "subcontractor",
  "trade partner", "invitation number", "solicitation number",
];

/**
 * Phrases in the SUBJECT that disqualify outright. The subject is the email's
 * declared intent: an invoice that mentions "the bid package" is still an
 * invoice, and no amount of supporting signal should outvote that.
 */
const VETO_SUBJECT = [
  "invoice", "remittance", "receipt", "statement", "payment application",
  "pay app", "aia g702", "lien waiver", "past due", "overdue", "payroll",
  "bid results", "award notice", "not selected", "awarded",
  "executed subcontract", "change order", "punch list", "rfi response",
  "addendum", "addenda", "schedule update", "safety orientation",
  "certificate of insurance", "policy renewal", "renewal notice",
  "out of office", "automatic reply", "auto-reply", "undeliverable",
  "delivery status notification", "read receipt", "recording is ready",
  "password", "verify your email", "security alert", "two-factor",
  "webinar", "newsletter", "digest", "your order", "shipping", "delivered",
  "delivery exception", "your bill", "subscription", "quotation", "your quote",
  "timesheet", "open enrollment", "tax documents", "registration",
];

/**
 * Phrases that disqualify wherever they appear. A human estimator sending a
 * real solicitation never includes a marketing footer.
 */
const VETO_ANYWHERE = [
  "unsubscribe", "manage your preferences", "you are receiving this",
  "we regret to inform", "was not selected", "bid results",
  "out of office", "automatic reply", "mail delivery failed", "undeliverable",
];

/** Body phrases that argue against, without being fatal on their own. */
const NEGATIVE_SIGNALS = [
  "payment received", "remittance advice", "statement of account",
  "meeting invitation", "has invited you to a meeting", "calendar invite",
  "tracking number", "shipping confirmation", "marketing",
];

/** Sender patterns that are machines, not estimators. */
const AUTOMATED_SENDERS = [
  "no-reply", "noreply", "donotreply", "do-not-reply", "mailer-daemon",
  "notifications@", "notification@", "bounce", "postmaster", "newsletter@",
  "marketing@", "billing@", "invoices@", "receipts@", "support@",
];

const PDF_EXT = /\.pdf$/i;

export function isPdf(a: InboundAttachment): boolean {
  return a.contentType.toLowerCase().includes("pdf") || PDF_EXT.test(a.fileName);
}

function domainOf(address: string): string {
  const at = address.lastIndexOf("@");
  return at === -1 ? "" : address.slice(at + 1).toLowerCase().trim().replace(/>$/, "");
}

/** Whole-phrase match, so "tender" doesn't fire inside "tendered". */
function containsPhrase(haystack: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

export interface DetectOptions {
  /**
   * Domains of GCs this user has bid with before. A known GC is a strong
   * signal — it's exactly the "verified contact" advantage, drawn from the
   * user's own history rather than a purchased database.
   */
  knownGcDomains?: string[];
}

/** Score above which we act without asking the model. */
export const ITB_THRESHOLD = 5;
/** Score above which we ask the model rather than dropping silently. */
export const UNCERTAIN_THRESHOLD = 2;

/**
 * Three gates, then a score.
 *
 * The gates encode what an ITB *is*, rather than what it correlates with. An
 * earlier additive-only version classified "Addendum 2" and "Executed
 * subcontract" from a familiar GC as solicitations, because known-sender plus a
 * PDF plus one generic phrase reached the threshold on their own. Routine mail
 * from a GC you already work with is the most common thing in an estimator's
 * inbox, so that's the worst possible false positive. Supporting signals now
 * only raise confidence in something that already looks like a solicitation;
 * they can't manufacture one.
 */
export function detectItb(email: InboundEmail, opts: DetectOptions = {}): DetectionResult {
  const reasons: string[] = [];
  let score = 0;

  const subject = (email.subject ?? "").toLowerCase();
  // Cap the body: a long thread shouldn't get more chances to match.
  const body = (email.text ?? "").slice(0, 20_000).toLowerCase();
  const haystack = `${subject}\n${body}`;
  const pdfAttachments = (email.attachments ?? []).filter(isPdf);

  const reject = (reason: string): DetectionResult => ({
    classification: "not_itb",
    score,
    reasons: [...reasons, reason],
    pdfAttachments,
  });

  // Gate 1 — the subject declares the email's intent. An invoice that mentions
  // "the bid package" is still an invoice.
  const subjectVeto = VETO_SUBJECT.find((p) => containsPhrase(subject, p));
  if (subjectVeto) return reject(`subject says this is not a solicitation ("${subjectVeto}")`);

  const anywhereVeto = VETO_ANYWHERE.find((p) => containsPhrase(haystack, p));
  if (anywhereVeto) return reject(`not a solicitation ("${anywhereVeto}")`);

  // Gate 2 — an ITB you can't open isn't actionable, and this drops every
  // newsletter that talks about bidding without carrying documents.
  if (pdfAttachments.length === 0) return reject("no PDF attachment — nothing to extract");

  // Gate 3 — it must actually ask for a bid, somewhere. Without this, a known
  // sender plus a PDF is enough to look like a solicitation, and it isn't.
  const solicits = STRONG_SUBJECT.filter((p) => containsPhrase(haystack, p));
  if (solicits.length === 0) return reject("nothing in the email asks for a bid");

  const inSubject = STRONG_SUBJECT.some((p) => containsPhrase(subject, p));
  score += inSubject ? 4 : 2;
  reasons.push(
    inSubject
      ? `subject names a solicitation: ${solicits.slice(0, 2).join(", ")}`
      : `body asks for a bid: ${solicits.slice(0, 2).join(", ")}`,
  );

  const bodyHits = BODY_SIGNALS.filter((p) => containsPhrase(haystack, p));
  if (bodyHits.length > 0) {
    // Cap it: ten generic phrases don't make it ten times more likely.
    score += Math.min(3, bodyHits.length);
    reasons.push(`bid language (${bodyHits.slice(0, 4).join(", ")})`);
  }

  score += 1;
  reasons.push(`${pdfAttachments.length} PDF attachment(s)`);

  const senderDomain = domainOf(email.from);
  const known = (opts.knownGcDomains ?? []).map((d) => d.toLowerCase());
  if (senderDomain && known.includes(senderDomain)) {
    score += 3;
    reasons.push(`sender is a GC you've bid with (${senderDomain})`);
  }

  const negatives = NEGATIVE_SIGNALS.filter((p) => containsPhrase(haystack, p));
  if (negatives.length > 0) {
    score -= 4 * negatives.length;
    reasons.push(`argues against (${negatives.slice(0, 3).join(", ")})`);
  }

  const fromLower = email.from.toLowerCase();
  if (AUTOMATED_SENDERS.some((s) => fromLower.includes(s))) {
    // Not fatal: some GC bid systems legitimately send from no-reply@.
    score -= 3;
    reasons.push("automated sender");
  }

  const classification: Classification =
    score >= ITB_THRESHOLD ? "itb" : score >= UNCERTAIN_THRESHOLD ? "uncertain" : "not_itb";

  return { classification, score, reasons, pdfAttachments };
}

/** Prompt for the uncertain band — cheap, and only for genuinely borderline mail. */
export function itbClassifierPrompt(email: InboundEmail): string {
  const attachments = email.attachments.map((a) => a.fileName).join(", ") || "none";
  return `You are triaging a construction subcontractor's email.

An Invitation to Bid (ITB) is a general contractor asking this subcontractor to price work on a specific project. It is NOT: an invoice, a payment application, an award/rejection notice, a newsletter, a webinar invite, a calendar invite, or an automated notification.

Answer with exactly one word: ITB or OTHER.

From: ${email.from}
Subject: ${email.subject}
Attachments: ${attachments}

Body:
${(email.text ?? "").slice(0, 3000)}`;
}

/** Coerce the classifier's reply. Anything unclear is OTHER — precision first. */
export function parseClassifierReply(reply: string): "itb" | "not_itb" {
  return /\bitb\b/i.test(reply.trim().split(/\s+/)[0] ?? "") ? "itb" : "not_itb";
}
