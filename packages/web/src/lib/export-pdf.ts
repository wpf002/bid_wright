import { computeTotals } from "./editor";
import { money } from "./export";
import { hexToRgb, type ProposalDoc } from "./proposal";

/**
 * The proposal PDF.
 *
 * jsPDF rather than the roadmap's suggested Puppeteer: rendering server-side
 * would mean shipping Chromium (~300 MB) with the API and running a browser per
 * export, for fidelity we don't need on a document that's a cover page, a
 * table, and some lists. This runs client-side, costs no infrastructure, and is
 * imported dynamically so it stays out of the main bundle.
 */

const MARGIN = 48;
const HEADER_H = 54;
const FOOTER_H = 34;

export async function buildPdf(doc: ProposalDoc): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const brand = hexToRgb(doc.company.brandColor);
  const contentW = pageW - MARGIN * 2;

  // Letterhead is drawn per page rather than once, because the roadmap's bar is
  // that it appears on *every* page — a header drawn once silently disappears
  // the moment a table paginates.
  const drawLetterhead = () => {
    if (doc.company.logoDataUrl) {
      try {
        // Fixed box, so a tall logo can't push into the body.
        pdf.addImage(doc.company.logoDataUrl, MARGIN, MARGIN - 18, 96, 30, undefined, "FAST");
      } catch {
        // A corrupt image must never stop the export.
      }
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text(doc.company.name, doc.company.logoDataUrl ? MARGIN + 108 : MARGIN, MARGIN);

    const contact = [doc.company.phone, doc.company.email].filter(Boolean).join("  ·  ");
    if (contact) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(contact, pageW - MARGIN, MARGIN - 4, { align: "right" });
    }

    pdf.setDrawColor(brand[0], brand[1], brand[2]);
    pdf.setLineWidth(1.5);
    pdf.line(MARGIN, MARGIN + 8, pageW - MARGIN, MARGIN + 8);
  };

  const drawFooter = () => {
    const page = pdf.getCurrentPageInfo().pageNumber;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`${doc.company.name} · ${doc.project.name}`, MARGIN, pageH - 20, { maxWidth: contentW - 60 });
    pdf.text(`Page ${page}`, pageW - MARGIN, pageH - 20, { align: "right" });
  };

  const newPage = () => {
    pdf.addPage();
    drawLetterhead();
    drawFooter();
    return MARGIN + HEADER_H;
  };

  /** Reserve vertical space, breaking the page when it won't fit. */
  const need = (y: number, height: number) => (y + height > pageH - FOOTER_H ? newPage() : y);

  const heading = (y: number, text: string) => {
    const at = need(y, 34);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(brand[0], brand[1], brand[2]);
    pdf.text(text.toUpperCase(), MARGIN, at);
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(MARGIN, at + 5, pageW - MARGIN, at + 5);
    return at + 20;
  };

  const paragraph = (y: number, text: string, size = 9.5) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(51, 65, 85);
    const lines = pdf.splitTextToSize(text, contentW) as string[];
    let at = y;
    // Line by line, so a long paragraph splits across pages instead of
    // overflowing off the bottom.
    for (const line of lines) {
      at = need(at, 13);
      pdf.text(line, MARGIN, at);
      at += 13;
    }
    return at;
  };

  const bullets = (y: number, items: string[]) => {
    let at = y;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(51, 65, 85);
    for (const item of items) {
      const lines = pdf.splitTextToSize(item, contentW - 14) as string[];
      at = need(at, lines.length * 12 + 4);
      pdf.setTextColor(brand[0], brand[1], brand[2]);
      pdf.text("•", MARGIN, at);
      pdf.setTextColor(51, 65, 85);
      pdf.text(lines, MARGIN + 12, at);
      at += lines.length * 12 + 4;
    }
    return at + 6;
  };

  // ---- cover page ---------------------------------------------------------

  drawLetterhead();
  drawFooter();
  let y = MARGIN + 90;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(28);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Bid Proposal", MARGIN, y);
  y += 30;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(14);
  pdf.setTextColor(71, 85, 105);
  y = (pdf.splitTextToSize(doc.project.name, contentW) as string[]).reduce((acc, line) => {
    pdf.text(line, MARGIN, acc);
    return acc + 19;
  }, y);
  y += 16;

  const facts: [string, string | null][] = [
    ["Prepared for", doc.project.generalContractor],
    ["Owner", doc.project.owner],
    ["Project address", doc.project.address],
    ["Bid deadline", doc.project.bidDeadline],
    ["Date issued", doc.dateIssued],
    ["Valid for", `${doc.validityDays} days`],
  ];
  for (const [label, value] of facts) {
    if (!value) continue;
    y = need(y, 16);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(label, MARGIN, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(15, 23, 42);
    pdf.text(pdf.splitTextToSize(value, contentW - 120) as string[], MARGIN + 110, y);
    y += 16;
  }

  y += 14;
  y = heading(y, "Executive summary");
  y = paragraph(y, doc.summary);

  // ---- scope narrative ----------------------------------------------------

  if (doc.scopeNarrative.length > 0) {
    y = heading(y + 10, "Scope of work");
    y = bullets(y, doc.scopeNarrative);
  }

  // ---- pricing ------------------------------------------------------------

  const totals = computeTotals(doc.lineItems, doc.overheadPercent, doc.profitPercent);

  y = heading(y + 8, "Pricing");
  autoTable(pdf, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN + HEADER_H, bottom: FOOTER_H + 14 },
    head: [["Description", "Qty", "Unit", "Unit cost", "Total"]],
    body: doc.lineItems.map((li) => [
      li.description,
      String(li.quantity),
      li.unit,
      money(li.unitCostCents),
      money(li.totalCostCents),
    ]),
    foot: [
      ["", "", "", "Subtotal", money(totals.subtotalCents)],
      ["", "", "", `Overhead (${doc.overheadPercent}%)`, money(totals.overheadCents)],
      ["", "", "", `Profit (${doc.profitPercent}%)`, money(totals.profitCents)],
      ["", "", "", "Total", money(totals.totalCents)],
    ],
    styles: { fontSize: 8.5, cellPadding: 5, textColor: [51, 65, 85] },
    headStyles: { fillColor: brand, textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [252, 252, 253] },
    columnStyles: {
      1: { halign: "right", cellWidth: 42 },
      2: { cellWidth: 38 },
      3: { halign: "right", cellWidth: 68 },
      4: { halign: "right", cellWidth: 72 },
    },
    // A long table spills onto new pages; autotable creates them, so the
    // letterhead has to be drawn from this hook or those pages come out bare.
    showHead: "everyPage",
    // ...but the totals go on the LAST page only. autotable repeats the foot on
    // every page by default, which prints the grand total under page 1's items
    // where it reads as that page's subtotal — on a document a GC signs, that's
    // a misstatement of the price.
    showFoot: "lastPage",
    didDrawPage: () => {
      if (pdf.getCurrentPageInfo().pageNumber > 1) {
        drawLetterhead();
        drawFooter();
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (pdf as any).lastAutoTable.finalY + 22;

  // ---- clauses ------------------------------------------------------------

  const section = (title: string, items: string[]) => {
    if (items.length === 0) return;
    y = heading(y, title);
    y = bullets(y, items);
    y += 4;
  };
  section("Assumptions", doc.assumptions);
  section("Clarifications", doc.clarifications);
  section("Exclusions", doc.exclusions);

  // ---- terms + signature --------------------------------------------------

  y = heading(y + 4, "Terms");
  y = paragraph(y, doc.terms, 8.5);

  // Keep the signature block whole: a name on one page and a date line on the
  // next looks like a mistake on a document someone is asked to sign.
  y = need(y + 24, 96);
  y = heading(y, "Acceptance");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  y = paragraph(y, "Signing below accepts this proposal and its stated assumptions, clarifications, and exclusions.", 8.5);
  y += 22;

  const colW = (contentW - 30) / 2;
  pdf.setDrawColor(148, 163, 184);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, y, MARGIN + colW, y);
  pdf.line(MARGIN + colW + 30, y, pageW - MARGIN, y);
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text("Authorized signature", MARGIN, y + 12);
  pdf.text("Date", MARGIN + colW + 30, y + 12);

  y += 34;
  pdf.line(MARGIN, y, MARGIN + colW, y);
  pdf.text(`For ${doc.project.generalContractor ?? "the General Contractor"}`, MARGIN, y + 12);

  if (doc.company.license) {
    pdf.setFontSize(7.5);
    pdf.text(`License ${doc.company.license}`, pageW - MARGIN, y + 12, { align: "right" });
  }

  return pdf.output("blob");
}
