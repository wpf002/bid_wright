import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Generate a realistic ITB PDF for a seeded demo bid.
 *
 * The demo needs real documents, not just rows: the editor's click-through
 * provenance renders the source PDF, and without one every seeded bid shows
 * "Could not load PDF".
 *
 * Page layout is deliberate. The seeded extraction marks every scope item
 * sourcePage: 2, so the scope of work must actually be on page 2 — otherwise
 * clicking a scope item jumps to a page that doesn't contain it, and the
 * provenance would be lying.
 */

export interface ItbSpec {
  projectName: string;
  projectAddress: string;
  owner: string;
  /** Null on a public solicitation — the agency solicits subs directly. */
  generalContractor: string | null;
  bidDeadline: string;
  rfiDeadline: string;
  walkthrough: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  division: string;
  /** Scope lines — these land on page 2 and match the extraction. */
  scope: string[];
  compliance: string[];
  exclusions: string[];
}

const PAGE = { w: 612, h: 792 };
const MARGIN = 56;
const LEAD = 15;

export async function buildItbPdf(spec: ItbSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(spec.projectName);
  doc.setSubject("Invitation to Bid");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.11, 0.16);

  const newPage = () => {
    const page = doc.addPage([PAGE.w, PAGE.h]);
    return { page, y: PAGE.h - MARGIN };
  };

  /** Draw a line, wrapping at the margin, and return the new y. */
  const write = (
    p: ReturnType<typeof newPage>,
    text: string,
    opts: { size?: number; bold?: boolean; gap?: number } = {},
  ) => {
    const size = opts.size ?? 10;
    const f = opts.bold ? bold : font;
    const maxW = PAGE.w - MARGIN * 2;

    // Wrap by measured width rather than a character count, so long scope
    // lines don't run off the page.
    const words = text.split(/\s+/);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) > maxW && line) {
        p.page.drawText(line, { x: MARGIN, y: p.y, size, font: f, color: ink });
        p.y -= LEAD;
        line = word;
      } else {
        line = next;
      }
    }
    if (line) {
      p.page.drawText(line, { x: MARGIN, y: p.y, size, font: f, color: ink });
      p.y -= LEAD;
    }
    p.y -= opts.gap ?? 0;
    return p;
  };

  // ---- page 1: cover + metadata ------------------------------------------
  const p1 = newPage();
  write(p1, "INVITATION TO BID", { size: 16, bold: true, gap: 10 });
  write(p1, `Project: ${spec.projectName}`);
  write(p1, `Location: ${spec.projectAddress}`);
  write(p1, `Owner: ${spec.owner}`, spec.generalContractor ? {} : { gap: 8 });
  // A federal ITB names no GC. Printing "General Contractor: null" would put a
  // fact in the document that the document doesn't state.
  if (spec.generalContractor) {
    write(p1, `General Contractor: ${spec.generalContractor}`, { gap: 8 });
  }
  write(p1, `Bid Due: ${spec.bidDeadline}`, { bold: true });
  write(p1, `Pre-Bid Walkthrough: ${spec.walkthrough}`);
  write(p1, `RFI Deadline: ${spec.rfiDeadline}`, { gap: 8 });
  write(p1, `Contact: ${spec.contactName} — ${spec.contactEmail} — ${spec.contactPhone}`, { gap: 16 });
  write(
    p1,
    "You are invited to submit a bid for the scope of work described herein. " +
      "Please review the attached drawings and specifications in full. " +
      "Bids received after the time stated above will not be considered.",
    { size: 9 },
  );

  // ---- page 2: scope of work (must match extraction sourcePage: 2) --------
  const p2 = newPage();
  write(p2, `SCOPE OF WORK — ${spec.division}`, { size: 12, bold: true, gap: 8 });
  spec.scope.forEach((line, i) => write(p2, `${i + 1}. ${line}`, { gap: 3 }));

  // ---- page 3: compliance -------------------------------------------------
  const p3 = newPage();
  write(p3, "COMPLIANCE & REQUIREMENTS", { size: 12, bold: true, gap: 8 });
  spec.compliance.forEach((line) => write(p3, line, { gap: 2 }));
  p3.y -= 10;
  write(p3, "EXCLUSIONS NOTED BY GC:", { bold: true, gap: 4 });
  spec.exclusions.forEach((line) => write(p3, `- ${line}`, { gap: 2 }));

  return doc.save();
}
