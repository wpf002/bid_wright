import { describe, it, expect } from "vitest";
import { choosePdf, scoreAttachment } from "../src/inbox/choose-pdf";
import type { InboundAttachment } from "../src/inbox/detect";

const pdf = (fileName: string, size = 300_000): InboundAttachment => ({
  fileName,
  contentType: "application/pdf",
  size,
});

describe("choosePdf on real federal ITB attachment sets", () => {
  it("picks the solicitation over drawings, wage determination, and exhibits", () => {
    // Verbatim from SAM.gov opportunity 05b40ce0 (Forest Service).
    const choice = choosePdf([
      pdf("C04_Attachment 1. Drawings_1240LU26Q0105.pdf", 2_882_382),
      pdf("C04_1240LU26Q0105.pdf", 500_420),
      pdf("C04_Attachment 2. FSSS_1240LU26Q0105.pdf"),
      pdf("C04_Attachment 3. Wage Determination_1240LU26Q0105.pdf"),
    ]);
    // Drawings were listed FIRST — the old code would have extracted those.
    expect(choice!.primary.fileName).not.toMatch(/Drawings/);
    expect(choice!.supporting).toHaveLength(3);
  });

  it("picks the Statement of Work over as-builts, RFI answers, and forms", () => {
    // Verbatim from SAM.gov opportunity e66f1550 (gym renovation).
    const choice = choosePdf([
      pdf("BLDG 124 - As-Builts.pdf"),
      pdf("RFI Question and Answer 31 -59.pdf"),
      pdf("Solicitation Amendment W50S6T26QA0280002 SF 30.pdf"),
      pdf("Statement of Work - Gym Renovation Revision 7.14.2026.pdf"),
      pdf("Base Access Request - 144 SFS DVES FORM (20240320).pdf"),
      pdf("Wage Determination CA20260018 Rev 5 18 May 2026.pdf"),
    ]);
    expect(choice!.primary.fileName).toMatch(/Statement of Work/);
    expect(choice!.supporting).toHaveLength(5);
  });

  it("picks the solicitation over a pile of technical exhibits", () => {
    // Verbatim from SAM.gov opportunity 08c4a2b7 (NOAA electrical).
    const choice = choosePdf([
      pdf("3_Technical_Exhibit_145027-26-0030.pdf"),
      pdf("2_Technical_Exhibit_SOW_Pictures_145027-26-0030.pdf", 28_467_372),
      pdf("Sol_1305M326Q0317.pdf", 398_063),
      pdf("4_Technical_Exhibit_145027-26-0030.pdf"),
    ]);
    expect(choice!.primary.fileName).toBe("Sol_1305M326Q0317.pdf");
  });

  it("does not mistake a SOW_Pictures scan for the SOW", () => {
    // "SOW" appears in the name, but so does "Pictures", and it's 28 MB.
    const scan = scoreAttachment(pdf("2_Technical_Exhibit_SOW_Pictures_145027-26-0030.pdf", 28_467_372));
    const sol = scoreAttachment(pdf("Sol_1305M326Q0317.pdf", 398_063));
    expect(sol.score).toBeGreaterThan(scan.score);
  });
});

describe("choosePdf basics", () => {
  it("returns null with no PDFs", () => {
    expect(choosePdf([])).toBeNull();
  });

  it("takes the only PDF without fuss", () => {
    const c = choosePdf([pdf("whatever.pdf")]);
    expect(c!.primary.fileName).toBe("whatever.pdf");
    expect(c!.supporting).toEqual([]);
    expect(c!.uncertain).toBe(false);
  });

  it("keeps every other PDF as supporting — nothing is thrown away", () => {
    const c = choosePdf([pdf("itb.pdf"), pdf("drawings.pdf"), pdf("wage.pdf")]);
    expect(c!.supporting.map((s) => s.fileName).sort()).toEqual(["drawings.pdf", "wage.pdf"]);
  });

  it("flags uncertainty when nothing looks like a solicitation", () => {
    // Better to record "we guessed" than to imply confidence we don't have.
    const c = choosePdf([pdf("scan001.pdf", 20_000_000), pdf("scan002.pdf", 20_000_000)]);
    expect(c!.uncertain).toBe(true);
    expect(c!.reasons.join(" ")).toMatch(/no filename signal|large/i);
  });

  it("breaks ties toward the first attachment", () => {
    // Senders lead with the solicitation more often than not.
    const c = choosePdf([pdf("aaa.pdf"), pdf("bbb.pdf")]);
    expect(c!.primary.fileName).toBe("aaa.pdf");
  });

  it("prefers a solicitation even when it is listed last", () => {
    const c = choosePdf([pdf("drawings.pdf"), pdf("wage determination.pdf"), pdf("invitation to bid.pdf")]);
    expect(c!.primary.fileName).toBe("invitation to bid.pdf");
  });
});

describe("scoreAttachment signals", () => {
  it("rewards solicitation names", () => {
    for (const n of ["solicitation.pdf", "ITB-2026.pdf", "RFQ_1234.pdf", "statement of work.pdf", "bid package.pdf"]) {
      expect(scoreAttachment(pdf(n)).score).toBeGreaterThan(0);
    }
  });

  it("penalizes supporting material", () => {
    for (const n of ["drawings.pdf", "as-built.pdf", "wage determination.pdf", "floor plan.pdf", "photo log.pdf"]) {
      expect(scoreAttachment(pdf(n)).score).toBeLessThan(0);
    }
  });

  it("treats a huge file as unlikely to be the solicitation", () => {
    expect(scoreAttachment(pdf("mystery.pdf", 30_000_000)).score)
      .toBeLessThan(scoreAttachment(pdf("mystery.pdf", 300_000)).score);
  });

  it("explains itself", () => {
    expect(scoreAttachment(pdf("Attachment 1. Drawings.pdf")).reasons.join(" ")).toMatch(/supporting/i);
  });
});
