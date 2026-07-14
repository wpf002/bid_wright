#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { extractFromPdf, generateBidResponse } from "@bidwright/core";
import { formatCents } from "@bidwright/shared";
import fs from "node:fs/promises";
import pc from "picocolors";

const program = new Command();
program
  .name("bidwright")
  .description("BidWright CLI — test extraction and generation locally")
  .version("0.1.0");

program
  .command("extract <pdfPath>")
  .description("Extract structured data from an ITB PDF")
  .option("--pretty", "Pretty-print summary instead of raw JSON")
  .action(async (pdfPath: string, opts) => {
    console.error(pc.dim(`→ Extracting ${pdfPath}...`));
    const result = await extractFromPdf(pdfPath);
    if (opts.pretty) {
      console.log(pc.bold(`\nProject: `) + (result.metadata.projectName ?? pc.dim("(not found)")));
      console.log(pc.bold(`GC: `) + (result.metadata.ownerOrGc ?? pc.dim("(not found)")));
      console.log(pc.bold(`Deadline: `) + (result.metadata.bidDeadline ?? pc.dim("(not found)")));
      console.log(pc.bold(`Primary trade: `) + result.primaryTrade);
      console.log(pc.bold(`\nScope items: `) + result.scope.length);
      for (const s of result.scope) {
        const conf = s.confidence >= 0.8 ? pc.green(`[${(s.confidence * 100).toFixed(0)}%]`)
                    : s.confidence >= 0.6 ? pc.yellow(`[${(s.confidence * 100).toFixed(0)}%]`)
                    : pc.red(`[${(s.confidence * 100).toFixed(0)}%]`);
        console.log(`  ${conf} ${s.description} ${pc.dim(`p.${s.sourcePage ?? "?"}`)}`);
      }
      if (result.warnings.length) {
        console.log(pc.bold(pc.yellow(`\nWarnings (${result.warnings.length}):`)));
        for (const w of result.warnings) console.log(pc.yellow(`  ⚠ ${w}`));
      }
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  });

program
  .command("bid <pdfPath>")
  .description("Extract + generate a full bid response")
  .option("-o, --output <file>", "Write output to file")
  .option("--pretty", "Pretty-print summary")
  .action(async (pdfPath: string, opts: { output?: string; pretty?: boolean }) => {
    console.error(pc.dim(`→ Extracting...`));
    const extraction = await extractFromPdf(pdfPath);
    console.error(pc.dim(`→ Generating bid response...`));
    const bid = await generateBidResponse(extraction, pdfPath.split("/").pop() ?? "itb.pdf");
    const out = JSON.stringify(bid, null, 2);
    if (opts.output) {
      await fs.writeFile(opts.output, out);
      console.error(pc.green(`✓ Wrote ${opts.output}`));
    }
    if (opts.pretty) {
      console.log(pc.bold(`\n${bid.itbFileName}`));
      console.log(pc.dim(`Line items: ${bid.lineItems.length}`));
      for (const li of bid.lineItems) {
        console.log(`  • ${li.description} — ${li.quantity} ${li.unit} @ ${formatCents(li.unitCostCents)}`);
      }
      console.log(pc.dim(`Assumptions: ${bid.assumptions.length}`));
      console.log(pc.dim(`Clarifications: ${bid.clarifications.length}`));
      console.log(pc.dim(`Exclusions: ${bid.exclusions.length}`));
    } else if (!opts.output) {
      console.log(out);
    }
  });

program.parse();
