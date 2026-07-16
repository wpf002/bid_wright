import { timingSafeEqual, randomBytes } from "node:crypto";
import type { InboundEmail } from "@bidwright/core";

/**
 * Postmark inbound adapter.
 *
 * Kept behind a normalized InboundEmail so swapping to SES/Mailgun (or adding
 * Nylas later) is one file, not a rewrite of the pipeline.
 */

/** The subset of Postmark's inbound payload we rely on. */
export interface PostmarkInbound {
  MessageID?: string;
  From?: string;
  FromName?: string;
  FromFull?: { Email?: string; Name?: string };
  To?: string;
  ToFull?: { Email?: string }[];
  OriginalRecipient?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  Date?: string;
  Attachments?: {
    Name?: string;
    ContentType?: string;
    ContentLength?: number;
    Content?: string; // base64
  }[];
}

/** Base64 attachment content, kept apart from the detection-facing shape. */
export interface InboundAttachmentData {
  fileName: string;
  contentType: string;
  size: number;
  contentBase64: string;
}

export interface NormalizedInbound {
  email: InboundEmail;
  attachmentData: InboundAttachmentData[];
}

/**
 * The address the mail was actually delivered to.
 *
 * Prefer OriginalRecipient: when a user auto-forwards from Gmail, the To:
 * header still says their own address, and only the envelope recipient carries
 * the u-<token>@ address we route on.
 */
export function deliveredTo(payload: PostmarkInbound): string {
  return (
    payload.OriginalRecipient ??
    payload.ToFull?.[0]?.Email ??
    payload.To ??
    ""
  ).trim();
}

/** Pull the inbound token out of `u-<token>@inbox.example.com` (or +token). */
export function parseInboundToken(address: string): string | null {
  const local = address.split("@")[0]?.trim().toLowerCase() ?? "";
  // u-<token> is the canonical form; user+token@ also works for providers that
  // only offer plus-addressing.
  const dash = /^u-([a-z0-9]{8,64})$/.exec(local);
  if (dash) return dash[1];
  const plus = /^[^+]+\+([a-z0-9]{8,64})$/.exec(local);
  return plus ? plus[1] : null;
}

export function normalizePostmark(payload: PostmarkInbound): NormalizedInbound {
  const attachments = payload.Attachments ?? [];
  const attachmentData: InboundAttachmentData[] = attachments.map((a) => ({
    fileName: a.Name ?? "attachment",
    contentType: a.ContentType ?? "application/octet-stream",
    size: a.ContentLength ?? 0,
    contentBase64: a.Content ?? "",
  }));

  return {
    email: {
      // Fall back to a random id rather than colliding every id-less message
      // onto one dedupe key.
      messageId: payload.MessageID ?? `generated-${randomBytes(12).toString("hex")}`,
      from: (payload.FromFull?.Email ?? payload.From ?? "").trim(),
      fromName: payload.FromFull?.Name ?? payload.FromName ?? null,
      to: deliveredTo(payload),
      subject: payload.Subject ?? "",
      text: payload.TextBody ?? "",
      html: payload.HtmlBody ?? null,
      receivedAt: payload.Date,
      attachments: attachmentData.map(({ fileName, contentType, size }) => ({
        fileName,
        contentType,
        size,
      })),
    },
    attachmentData,
  };
}

/**
 * Verify the webhook is really from our provider.
 *
 * Postmark doesn't sign inbound payloads; the documented approach is a secret
 * embedded in the webhook URL plus basic auth. Anyone who can POST here can
 * put bids on a user's board, so this must never be skipped in production —
 * hence the explicit refusal below rather than a silent allow.
 */
export function verifyInboundSecret(provided: string | undefined, expected: string | undefined): boolean {
  if (!expected) {
    throw new Error(
      "INBOUND_WEBHOOK_SECRET is not set — refusing to accept unauthenticated inbound mail",
    );
  }
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // Length must match before timingSafeEqual, and comparing lengths first is
  // fine: the length of a secret isn't the secret.
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Generate an unguessable inbound token. */
export function generateInboundToken(): string {
  return randomBytes(12).toString("hex"); // 96 bits, 24 chars
}

/** The full forwarding address for a token. */
export function inboundAddress(token: string, domain = process.env.INBOUND_DOMAIN): string {
  return `u-${token}@${domain ?? "inbox.bidwright.app"}`;
}
