import { computeTotals } from "./editor";
import { money, type ProposalData } from "./export";

/**
 * PDF proposal. jsPDF + autotable are imported dynamically to keep them out of
 * the main bundle.
 *
 * Phase 7 replaces this with a proper template engine (letterhead, cover page,
 * signature block). This produces a clean, paginating proposal today.
 */
export async function buildPdf(data: ProposalData): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(data.companyName, margin, y);
  y += 22;

  doc.setFontSize(20);
  doc.text("Bid Proposal", margin, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const meta: [string, string | null][] = [
    ["Project", data.projectName],
    ["Address", data.projectAddress],
    ["General Contractor", data.generalContractor],
    ["Owner", data.owner],
    ["Bid deadline", data.bidDeadline],
  ];
  for (const [k, v] of meta) {
    if (!v) continue;
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, margin, y);
    doc.setFont("helvetica", "normal");
    // Wrap long values instead of running off the page.
    const lines = doc.splitTextToSize(v, pageWidth - margin * 2 - 110) as string[];
    doc.text(lines, margin + 110, y);
    y += 14 * lines.length;
  }

  const totals = computeTotals(data.lineItems, data.overheadPercent, data.profitPercent);

  autoTable(doc, {
    startY: y + 10,
    margin: { left: margin, right: margin },
    head: [["Description", "Qty", "Unit", "Unit Cost", "Total"]],
    body: data.lineItems.map((li) => [
      li.description,
      String(li.quantity),
      li.unit,
      money(li.unitCostCents),
      money(li.totalCostCents),
    ]),
    foot: [
      ["", "", "", "Subtotal", money(totals.subtotalCents)],
      ["", "", "", `Overhead (${data.overheadPercent}%)`, money(totals.overheadCents)],
      ["", "", "", `Profit (${data.profitPercent}%)`, money(totals.profitCents)],
      ["", "", "", "Total", money(totals.totalCents)],
    ],
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    footStyles: { fillColor: [255, 255, 255], textColor: [15, 23, 42] },
    columnStyles: {
      1: { halign: "right", cellWidth: 44 },
      2: { cellWidth: 40 },
      3: { halign: "right", cellWidth: 70 },
      4: { halign: "right", cellWidth: 70 },
    },
    // Long tables paginate; repeat the header on each page.
    showHead: "everyPage",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 24;

  const section = (title: string, items: string[]) => {
    if (!items.length) return;
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y > pageHeight - 100) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const item of items) {
      const lines = doc.splitTextToSize(`• ${item}`, pageWidth - margin * 2) as string[];
      if (y + lines.length * 12 > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(lines, margin, y);
      y += lines.length * 12 + 3;
    }
    y += 12;
  };

  section("Assumptions", data.assumptions);
  section("Clarifications", data.clarifications);
  section("Exclusions", data.exclusions);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text(
    `This proposal is valid for ${data.validityDays} days from the date of issue.`,
    margin,
    Math.min(y, doc.internal.pageSize.getHeight() - margin),
  );

  return doc.output("blob");
}
