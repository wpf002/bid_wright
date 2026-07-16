import { computeTotals } from "./editor";
import { money, type ProposalData } from "./export";

/**
 * Word proposal. `docx` is imported dynamically so it stays out of the main
 * bundle — most sessions never export.
 *
 * Phase 7 adds letterhead, branding, and a cover page; this is the honest
 * working version.
 */
export async function buildDocx(data: ProposalData): Promise<Blob> {
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle,
  } = await import("docx");

  const totals = computeTotals(data.lineItems, data.overheadPercent, data.profitPercent);

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
    ["Project", data.projectName],
    ["Address", data.projectAddress],
    ["General Contractor", data.generalContractor],
    ["Owner", data.owner],
    ["Bid deadline", data.bidDeadline],
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

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: data.companyName, bold: true, size: 28 })],
          }),
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

          new Paragraph({ text: "Scope and Pricing", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } }),
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
              ...data.lineItems.map(
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
                  cell(`Overhead (${data.overheadPercent}%)`, { right: true }),
                  cell(money(totals.overheadCents), { right: true }),
                ],
              }),
              new TableRow({
                children: [
                  cell(""), cell(""), cell(""),
                  cell(`Profit (${data.profitPercent}%)`, { right: true }),
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

          ...section("Assumptions", data.assumptions),
          ...section("Clarifications", data.clarifications),
          ...section("Exclusions", data.exclusions),

          new Paragraph({
            spacing: { before: 300 },
            children: [
              new TextRun({
                text: `This proposal is valid for ${data.validityDays} days from the date of issue.`,
                italics: true,
                size: 18,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
