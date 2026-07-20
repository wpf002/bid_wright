import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadRootEnv } from "../load-env";
import { buildItbPdf } from "./itb-pdf";
import { DEMO_PROJECTS, type DemoProject } from "./projects";

// Must run before importing the client, which reads DATABASE_URL at module load.
const ROOT = loadRootEnv();

const DEMO_EMAIL = "demo@bidwright.app";
const DEMO_PASSWORD = "demo-password-123";
const DAY = 86_400_000;

/**
 * Where the API serves uploaded PDFs from.
 *
 * Mirrors packages/api/src/storage/files.ts rather than importing it — db must
 * not depend on api (api already depends on db). Kept to the same two env vars
 * so the seed writes exactly where the API reads.
 */
function uploadDir(): string {
  const configured = process.env.UPLOAD_DIR;
  return configured ? path.resolve(ROOT, configured) : path.join(ROOT, "uploads");
}

/** The extraction a real Opus run would have produced for this project. */
function extractionFor(p: DemoProject) {
  return {
    metadata: {
      projectName: p.itb.projectName,
      projectAddress: p.itb.projectAddress,
      owner: p.itb.owner,
      generalContractor: p.itb.generalContractor,
      bidDeadline: p.itb.bidDeadline,
      rfiDeadline: p.itb.rfiDeadline,
      walkthroughDate: p.itb.walkthrough,
      contactName: p.itb.contactName,
      contactEmail: p.itb.contactEmail,
      contactPhone: p.itb.contactPhone,
    },
    scope: p.scope.map((s, i) => ({
      id: `s${i + 1}`,
      description: s.description,
      trade: p.trade,
      quantity: s.quantity,
      unit: s.unit,
      notes: s.notes,
      confidence: s.confidence,
      // The generated PDF puts the scope of work on page 2, so this is true —
      // clicking a scope item lands on the page that contains it.
      sourcePage: 2,
    })),
    inclusions: [`${p.itb.division} work as scoped`],
    exclusions: p.itb.exclusions,
    compliance: p.compliance,
    primaryTrade: p.trade,
    warnings: p.warnings,
    rawTextPreview: `INVITATION TO BID — ${p.itb.projectName}…`,
    pageCount: 3,
  };
}

function lineItemsFor(p: DemoProject) {
  return p.scope.map((s, i) => ({
    id: `li-${i + 1}`,
    description: s.description,
    quantity: s.quantity ?? 1,
    unit: s.unit ?? "LS",
    // Unpriced: the estimator prices the bid. Phase 4 folds real prices into
    // cost history only once a bid is finalized.
    unitCostCents: 0,
    totalCostCents: 0,
    notes: s.notes,
    sourcePage: 2,
    confidence: null,
  }));
}

/**
 * One genuinely real bid: NOAA solicitation 1305M326Q0317, the actual 65-page
 * federal RFQ, with the extraction and draft a real Opus run produced from it.
 * The other demo bids carry synthetic PDFs; this one ships the real document so
 * provenance click-through lands on the real pages (17–20), and so the demo has
 * one example that isn't made up. The PDF and its extraction live in ./assets,
 * resolved from the repo root so this works regardless of the seed's cwd.
 */
async function loadRealBidAsset() {
  const dir = path.join(ROOT, "packages/db/src/seed/assets");
  const pdf = await fsp.readFile(path.join(dir, "noaa-wrc-h32.pdf"));
  const data = JSON.parse(await fsp.readFile(path.join(dir, "noaa-wrc-h32.json"), "utf8"));
  return { pdf, data };
}

async function seed() {
  const { db } = await import("../client");
  const { users, bids, uploads } = await import("../schema");
  const { eq } = await import("drizzle-orm");
  const bcrypt = (await import("bcryptjs")).default;

  console.log("🌱 Seeding database...");

  // Idempotent: wipe and recreate the demo user (bids and uploads cascade).
  await db.delete(users).where(eq(users.email, DEMO_EMAIL));

  const [user] = await db
    .insert(users)
    .values({
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      companyName: "Foti Electric",
      primaryTrade: "electrical",
    })
    .returning();

  const dir = uploadDir();
  await fsp.mkdir(dir, { recursive: true });

  const now = Date.now();
  for (const p of DEMO_PROJECTS) {
    // A real PDF per project, so the editor's provenance has a document to
    // render. Without one every seeded bid shows "Could not load PDF".
    const pdf = await buildItbPdf(p.itb);
    const storageKey = `${randomUUID()}.pdf`;
    await fsp.writeFile(path.join(dir, storageKey), pdf);

    const [bid] = await db
      .insert(bids)
      .values({
        userId: user.id,
        itbFileName: p.file,
        projectName: p.projectName,
        gcName: p.itb.generalContractor,
        ownerName: p.itb.owner,
        primaryTrade: p.trade,
        status: p.status,
        bidDeadline: p.deadlineInDays === null ? null : new Date(now + p.deadlineInDays * DAY),
        extraction: extractionFor(p),
        lineItems: lineItemsFor(p),
        assumptions: p.assumptions,
        clarifications: p.clarifications,
        exclusions: p.exclusions,
      })
      .returning();

    await db.insert(uploads).values({
      bidId: bid.id,
      fileName: p.file,
      fileSize: pdf.length,
      storagePath: storageKey,
    });

    console.log(`   ${p.file} — ${(pdf.length / 1024).toFixed(0)} KB, ${p.scope.length} scope items`);
  }

  // The one real bid: real PDF, real extraction, real generated draft.
  const real = await loadRealBidAsset();
  const realKey = `${randomUUID()}.pdf`;
  await fsp.writeFile(path.join(dir, realKey), real.pdf);

  const [realBid] = await db
    .insert(bids)
    .values({
      userId: user.id,
      itbFileName: real.data.itbFileName,
      projectName: real.data.projectName,
      gcName: real.data.gcName,
      ownerName: real.data.ownerName,
      primaryTrade: real.data.primaryTrade,
      status: real.data.status,
      bidDeadline:
        real.data.deadlineInDays === null ? null : new Date(now + real.data.deadlineInDays * DAY),
      extraction: real.data.extraction,
      lineItems: real.data.lineItems,
      assumptions: real.data.assumptions,
      clarifications: real.data.clarifications,
      exclusions: real.data.exclusions,
      // Priced so the demo has one bid with a real total flowing through the
      // markup. The numbers are illustrative placeholders (see the asset's
      // _pricingNote), not a real estimate.
      subtotalCents: real.data.subtotalCents ?? 0,
      overheadPercent: real.data.overheadPercent ?? 10,
      profitPercent: real.data.profitPercent ?? 10,
      totalCents: real.data.totalCents ?? 0,
    })
    .returning();

  await db.insert(uploads).values({
    bidId: realBid.id,
    fileName: real.data.itbFileName,
    fileSize: real.pdf.length,
    storagePath: realKey,
  });

  console.log(
    `   ${real.data.itbFileName} — ${(real.pdf.length / 1024).toFixed(0)} KB, ` +
      `${real.data.extraction.scope.length} scope items, priced $${((real.data.totalCents ?? 0) / 100).toLocaleString()} ` +
      `(REAL federal RFQ, ${real.data.extraction.pageCount}p)`,
  );

  console.log(`✅ Seeded ${DEMO_PROJECTS.length + 1} bids (${DEMO_PROJECTS.length} synthetic + 1 real)`);
  console.log(`   Log in as: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
