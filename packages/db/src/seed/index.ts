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

  console.log(`✅ Seeded ${DEMO_PROJECTS.length} bids with real ITB PDFs`);
  console.log(`   Log in as: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
