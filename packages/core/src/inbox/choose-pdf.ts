import type { InboundAttachment } from "./detect";

/**
 * Choosing which attachment to extract from.
 *
 * A real ITB arrives with several PDFs: the solicitation, drawings, a wage
 * determination, RFI answers, exhibits. Ingestion used to take
 * pdfAttachments[0] — whichever the mail client happened to list first. Testing
 * against seven real federal solicitations showed the cost: extracting a
 * drawing set yielded one low-confidence scope item, and a floor plan got
 * classified as fire protection at 57% confidence. The document was wrong, so
 * everything downstream was wrong.
 *
 * Filename is the cheapest strong signal — a file called
 * "Attachment 1. Drawings.pdf" is not the solicitation, and nobody has to open
 * it to know that.
 */

/**
 * Split a filename into words before matching.
 *
 * Underscores are word characters, so \b never fires inside
 * "Sol_1305M326Q0317" or "3_Technical_Exhibit_145027" — and federal filenames
 * are almost entirely underscores and digits. Matching the raw name silently
 * saw nothing in exactly the files this has to read. Normalize separators and
 * digit runs to spaces first, then match on whole words.
 */
export function normalizeFileName(fileName: string): string {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "") // drop the extension
    .replace(/[_\-.,()[\]]+/g, " ") // separators -> spaces
    .replace(/\d+/g, " ") // job numbers carry no signal
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase -> two words
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Names that mark a file as the actual solicitation. */
const SOLICITATION_HINTS: [RegExp, number][] = [
  [/\b(solicitations?|sol)\b/, 5],
  [/\b(invitations?|itb|ifb)\b/, 5],
  [/\b(rfq|rfp)\b/, 4],
  [/\b(statement of work|sow|pws)\b/, 4],
  [/\bscopes?\b/, 3],
  [/\b(specifications?|specs?)\b/, 2],
  [/\bbid (packages?|docs?|documents?)\b/, 4],
  [/\bproposals?\b/, 2],
];

/** Names that mark a file as supporting material, not the ask. */
const SUPPORTING_HINTS: [RegExp, number][] = [
  [/\b(drawings?|dwg|plans?|sheets?|as built|floor plan)\b/, -6],
  [/\b(wages?|davis bacon|determinations?)\b/, -6],
  [/\b(photos?|pictures?|images?|exhibits?|maps?)\b/, -5],
  [/\b(amendments?|addendum|addenda)\b/, -3],
  [/\b(q a|questions?|answers?|rfi)\b/, -3],
  [/\b(forms?|certificat\w*|insurance|w9|access request)\b/, -4],
  [/\b(attachments?|appendix|annexe?s?)\b/, -1],
];

export interface ScoredAttachment {
  attachment: InboundAttachment;
  score: number;
  reasons: string[];
}

/**
 * Score one attachment on how likely it is to BE the solicitation.
 * Filename and size only — this runs before we've read anything, and the whole
 * point is to avoid paying to extract the wrong file.
 */
export function scoreAttachment(a: InboundAttachment): ScoredAttachment {
  const reasons: string[] = [];
  let score = 0;
  const name = normalizeFileName(a.fileName);

  for (const [re, points] of SOLICITATION_HINTS) {
    const hit = name.match(re);
    if (hit) {
      score += points;
      reasons.push(`"${hit[0]}" in the name reads as a solicitation`);
      break; // one positive naming signal is enough; don't stack synonyms
    }
  }

  for (const [re, points] of SUPPORTING_HINTS) {
    const hit = name.match(re);
    if (hit) {
      score += points;
      reasons.push(`"${hit[0]}" in the name reads as supporting material`);
    }
  }

  // Drawing sets and scans are big; solicitations are usually a few hundred KB.
  // Weak signal, so it only breaks ties.
  if (a.size > 10_000_000) {
    score -= 2;
    reasons.push("very large — likely drawings or a scan");
  } else if (a.size > 0 && a.size < 400_000) {
    score += 1;
    reasons.push("small enough to be a solicitation");
  }

  return { attachment: a, score, reasons };
}

export interface PdfChoice {
  /** The attachment to extract from. */
  primary: InboundAttachment;
  /** Everything else, kept so drawings and addenda aren't thrown away. */
  supporting: InboundAttachment[];
  score: number;
  reasons: string[];
  /** True when nothing scored positively and we fell back to the first file. */
  uncertain: boolean;
}

/**
 * Pick the attachment to extract, keeping the rest.
 *
 * Ties break toward the earlier attachment: senders tend to lead with the
 * solicitation, so original order is a real (if weak) signal.
 */
export function choosePdf(pdfs: InboundAttachment[]): PdfChoice | null {
  if (pdfs.length === 0) return null;
  if (pdfs.length === 1) {
    const only = scoreAttachment(pdfs[0]);
    return {
      primary: pdfs[0],
      supporting: [],
      score: only.score,
      reasons: ["only one PDF attached"],
      uncertain: false,
    };
  }

  const scored = pdfs.map(scoreAttachment);
  let best = 0;
  for (let i = 1; i < scored.length; i++) {
    if (scored[i].score > scored[best].score) best = i;
  }

  const winner = scored[best];
  const rest = scored.filter((_, i) => i !== best);
  // A bare name like "C04_1240LU26Q0105.pdf" says nothing about itself; it wins
  // because everything around it is visibly a drawing or a wage determination.
  // Say that, rather than claiming a signal we didn't have.
  const byElimination = winner.reasons.length === 0 && rest.some((s) => s.score < 0);

  return {
    primary: winner.attachment,
    supporting: pdfs.filter((_, i) => i !== best),
    score: winner.score,
    reasons: winner.reasons.length
      ? winner.reasons
      : byElimination
        ? ["no signal in the name — the other attachments all look like supporting material"]
        : ["no filename signal — fell back to the first attachment"],
    // Nothing looked like a solicitation: worth saying so in the audit log
    // rather than quietly picking one.
    uncertain: winner.score <= 0,
  };
}
