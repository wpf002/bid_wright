import type { InboundAttachment } from "./detect";

/**
 * How much of an ITB's supporting material we keep.
 *
 * Ingestion stores the drawings, addenda, and wage determinations that arrive
 * alongside the solicitation, because the estimator has to bid them and the
 * email itself isn't kept. But we never read these — only the primary is
 * extracted — so they are pure disk cost, and a single scanned drawing set runs
 * to tens of megabytes. Every forwarded ITB would land its full attachment
 * payload on disk forever.
 *
 * The trade the limits make: keep the small documents that carry terms an
 * estimator needs at hand (an addendum, a wage determination, an RFI answer
 * sheet), and skip the large scans. A skipped file is not lost — it is still in
 * the user's own mailbox, which is where it came from.
 */

/** Bigger than this and it's a drawing set or a scan, which we don't read. */
export const MAX_SUPPORTING_FILE_BYTES = 10 * 1024 * 1024;

/** Total across one ITB's supporting files. */
export const MAX_SUPPORTING_TOTAL_BYTES = 25 * 1024 * 1024;

/** Federal postings carry a long tail of small exhibits; this is generous. */
export const MAX_SUPPORTING_FILES = 12;

export interface SupportingLimits {
  maxFileBytes: number;
  maxTotalBytes: number;
  maxFiles: number;
}

export const DEFAULT_SUPPORTING_LIMITS: SupportingLimits = {
  maxFileBytes: MAX_SUPPORTING_FILE_BYTES,
  maxTotalBytes: MAX_SUPPORTING_TOTAL_BYTES,
  maxFiles: MAX_SUPPORTING_FILES,
};

export interface SkippedAttachment {
  fileName: string;
  size: number;
  /** Plain language — this reaches the user's inbox activity log. */
  reason: string;
}

export interface SupportingPlan {
  keep: InboundAttachment[];
  skipped: SkippedAttachment[];
  /** Bytes we intend to write for the supporting files. */
  totalBytes: number;
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Decide which supporting attachments to store.
 *
 * Smallest first: under a total-bytes budget, taking the small files first
 * keeps the most documents. Original order is not meaningful here — unlike the
 * primary, where senders lead with the solicitation, there's no convention
 * about which exhibit comes first.
 *
 * Skips are returned rather than dropped quietly: nothing in the UI lists these
 * files yet, so an unrecorded skip would be invisible.
 */
export function planSupportingUploads(
  supporting: InboundAttachment[],
  limits: SupportingLimits = DEFAULT_SUPPORTING_LIMITS,
): SupportingPlan {
  const keep: InboundAttachment[] = [];
  const skipped: SkippedAttachment[] = [];
  let totalBytes = 0;

  const bySize = [...supporting].sort((a, b) => a.size - b.size);

  for (const att of bySize) {
    if (att.size > limits.maxFileBytes) {
      skipped.push({
        fileName: att.fileName,
        size: att.size,
        reason: `too large to keep (${mb(att.size)}, limit ${mb(limits.maxFileBytes)})`,
      });
      continue;
    }
    if (keep.length >= limits.maxFiles) {
      skipped.push({
        fileName: att.fileName,
        size: att.size,
        reason: `over the ${limits.maxFiles}-file limit for supporting attachments`,
      });
      continue;
    }
    if (totalBytes + att.size > limits.maxTotalBytes) {
      skipped.push({
        fileName: att.fileName,
        size: att.size,
        reason: `over the ${mb(limits.maxTotalBytes)} total limit for supporting attachments`,
      });
      continue;
    }

    keep.push(att);
    totalBytes += att.size;
  }

  return { keep, skipped, totalBytes };
}

/** One line for the inbound audit log, or null when nothing was skipped. */
export function describeSkipped(skipped: SkippedAttachment[]): string | null {
  if (skipped.length === 0) return null;
  const names = skipped.map((s) => `${s.fileName} (${s.reason})`).join("; ");
  return `Kept the solicitation but skipped ${skipped.length} supporting ${
    skipped.length === 1 ? "attachment" : "attachments"
  }: ${names}`;
}
