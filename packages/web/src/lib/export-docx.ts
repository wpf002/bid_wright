import { computeTotals } from "./editor";
import { money } from "./export";
import { hexToRgb, type ProposalDoc } from "./proposal";

/**
 * Word proposal. `docx` is imported dynamically so it stays out of the main
 * bundle — most sessions never export.
 *
 * Phase 7 adds letterhead, branding, and a cover page; this is the honest
 * working version.
 */
export async function buildDocx(doc: ProposalDoc): Promise<Blob> {
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle, Header,
  } = await import("docx");

  const totals = computeTotals(doc.lineItems, doc.overheadPercent, doc.profitPercent);
  const [br, bg, bb] = hexToRgb(doc.company.brandColor);
  const brandHex = [br, bg, bb].map((c) => c.toString(16).padStart(2, "0")).join("");

  const cell = (text: string, opts: { bold?: boolean; right?: boolean } = {}) =>
    new TableCell({
      children: [
        new Paragraph({
          alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [new TextRun({ text, bold: opts.bold, size: 20 })],
        }),
      ],
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
    });

  const meta: [string, string | null][] = [
    ["Project", doc.project.name],
    ["Prepared for", doc.project.generalContractor],
    ["Owner", doc.project.owner],
    ["Project address", doc.project.address],
    ["Bid deadline", doc.project.bidDeadline],
    ["Date issued", doc.dateIssued],
    ["Valid for", `${doc.validityDays} days`],
  ];

  const section = (title: string, items: string[]) =>
    items.length
      ? [
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } }),
          ...items.map(
            (t) => new Paragraph({ text: t, bullet: { level: 0 }, spacing: { after: 60 } }),
          ),
        ]
      : [];

  const document = new Document({
    sections: [
      {
        properties: {},
        // Word repeats a header on every page natively, which is how the
        // letterhead requirement is met in docx.
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun({ text: doc.company.name, bold: true, size: 18, color: brandHex })],
                border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: brandHex } },
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: doc.company.name, bold: true, size: 28, color: brandHex })],
          }),
          ...([doc.company.address, [doc.company.phone, doc.company.email].filter(Boolean).join("  ·  "), doc.company.license ? `License ${doc.company.license}` : null]
            .filter(Boolean)
            .map((line) => new Paragraph({ children: [new TextRun({ text: line as string, size: 16, color: "64748B" })] }))),
          new Paragraph({
            text: "Bid Proposal",
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 },
          }),

          ...meta
            .filter(([, v]) => v)
            .map(
              ([k, v]) =>
                new Paragraph({
                  spacing: { after: 40 },
                  children: [
                    new TextRun({ text: `${k}: `, bold: true, size: 20 }),
                    new TextRun({ text: v as string, size: 20 }),
                  ],
                }),
            ),

          new Paragraph({ text: "Executive summary", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } }),
          new Paragraph({ children: [new TextRun({ text: doc.summary, size: 19 })], spacing: { after: 120 } }),

          ...section("Scope of work", doc.scopeNarrative),

          new Paragraph({ text: "Pricing", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
            },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  cell("Description", { bold: true }),
                  cell("Qty", { bold: true, right: true }),
                  cell("Unit", { bold: true }),
                  cell("Unit Cost", { bold: true, right: true }),
                  cell("Total", { bold: true, right: true }),
                ],
              }),
              ...doc.lineItems.map(
                (li) =>
                  new TableRow({
                    children: [
                      cell(li.description),
                      cell(String(li.quantity), { right: true }),
                      cell(li.unit),
                      cell(money(li.unitCostCents), { right: true }),
                      cell(money(li.totalCostCents), { right: true }),
                    ],
                  }),
              ),
              new TableRow({
                children: [
                  cell(""), cell(""), cell(""),
                  cell("Subtotal", { bold: true, right: true }),
                  cell(money(totals.subtotalCents), { right: true }),
                ],
              }),
              new TableRow({
                children: [
                  cell(""), cell(""), cell(""),
                  cell(`Overhead (${doc.overheadPercent}%)`, { right: true }),
                  cell(money(totals.overheadCents), { right: true }),
                ],
              }),
              new TableRow({
                children: [
                  cell(""), cell(""), cell(""),
                  cell(`Profit (${doc.profitPercent}%)`, { right: true }),
                  cell(money(totals.profitCents), { right: true }),
                ],
              }),
              new TableRow({
                children: [
                  cell(""), cell(""), cell(""),
                  cell("Total", { bold: true, right: true }),
                  cell(money(totals.totalCents), { bold: true, right: true }),
                ],
              }),
            ],
          }),

          ...section("Assumptions", doc.assumptions),
          ...section("Clarifications", doc.clarifications),
          ...section("Exclusions", doc.exclusions),

          new Paragraph({ text: "Terms", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } }),
          new Paragraph({ children: [new TextRun({ text: doc.terms, size: 17 })] }),

          new Paragraph({ text: "Acceptance", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Signing below accepts this proposal and its stated assumptions, clarifications, and exclusions.",
                size: 17,
              }),
            ],
            spacing: { after: 400 },
          }),
          new Paragraph({ children: [new TextRun({ text: "Authorized signature: ______________________________    Date: ______________", size: 18 })] }),
        ],
      },
    ],
  });

  return Packer.toBlob(document);
}
