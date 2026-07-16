import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";

// Find the monorepo .env before importing the client, which reads DATABASE_URL
// at module load. `npm run db:seed` runs with cwd = packages/db.
(function loadRootEnv() {
  let dir = process.cwd();
  for (;;) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) {
      config({ path: candidate });
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
})();

const DEMO_EMAIL = "demo@bidwright.app";
const DEMO_PASSWORD = "demo-password-123";

/** A compact but realistic extraction, shaped like a real Opus run. */
const DEMO_EXTRACTION = {
  metadata: {
    projectName: "Northside Elementary School — Electrical Renovation",
    projectAddress: "1420 Maple Ave, Dallas, TX 75201",
    owner: "Dallas Independent School District",
    generalContractor: "Turner Ridge Construction, LLC",
    bidDeadline: "August 12, 2026, 2:00 PM CST",
    rfiDeadline: "August 5, 2026",
    walkthroughDate: "July 29, 2026, 10:00 AM",
    contactName: "Maria Alvarez",
    contactEmail: "malvarez@turnerridge.com",
    contactPhone: "(214) 555-0182",
  },
  scope: [
    { id: "s1", description: "Demolish and remove existing lighting fixtures, Classrooms 100-118", trade: "electrical", quantity: 240, unit: "EA", notes: null, confidence: 0.95, sourcePage: 2 },
    { id: "s2", description: "Furnish and install LED 2x4 troffers", trade: "electrical", quantity: 260, unit: "EA", notes: null, confidence: 0.92, sourcePage: 2 },
    { id: "s3", description: "Install 480V/208V, 300 kVA transformer", trade: "electrical", quantity: 1, unit: "EA", notes: "Main electrical room", confidence: 0.9, sourcePage: 2 },
    { id: "s4", description: "Install EMT conduit for branch circuits", trade: "electrical", quantity: 3500, unit: "LF", notes: null, confidence: 0.85, sourcePage: 2 },
    { id: "s5", description: "Pull copper branch wiring, THHN #12 AWG", trade: "electrical", quantity: 12000, unit: "LF", notes: null, confidence: 0.85, sourcePage: 2 },
    { id: "s6", description: "Furnish and install fire alarm devices", trade: "fire_protection", quantity: 45, unit: "EA", notes: "Tie into existing panel", confidence: 0.7, sourcePage: 2 },
  ],
  inclusions: ["Division 26 electrical work as scoped"],
  exclusions: ["Temporary power", "Patching and painting", "Cutting of finished surfaces"],
  compliance: {
    bondRequired: true, bondPercent: 5, insuranceRequired: true,
    insuranceLimits: ["General Liability $2,000,000 aggregate", "Auto $1,000,000", "Workers Comp statutory"],
    licenseRequirements: ["Texas Master Electrician license"],
    prevailingWage: true, unionRequired: false, davisBacon: true, prequalRequired: true,
    otherRequirements: ["100% Performance & Payment Bond upon award"],
  },
  primaryTrade: "electrical",
  warnings: [
    "Quantities for conduit, wiring, and fixtures are approximate per the document; verify before bidding.",
    "Fire alarm device scope may be handled as low_voltage; verify trade responsibility.",
  ],
  rawTextPreview: "INVITATION TO BID — Northside Elementary School — Electrical Renovation…",
  pageCount: 3,
};

const DEMO_LINE_ITEMS = DEMO_EXTRACTION.scope.map((s, i) => ({
  id: `li-${i + 1}`,
  description: s.description,
  quantity: s.quantity ?? 1,
  unit: s.unit ?? "LS",
  unitCostCents: 0,
  totalCostCents: 0,
  notes: s.notes,
  sourcePage: s.sourcePage,
  confidence: null,
}));

const DAY = 86_400_000;

async function seed() {
  const { db } = await import("../client");
  const { users, bids } = await import("../schema");
  const { eq } = await import("drizzle-orm");
  const bcrypt = (await import("bcryptjs")).default;

  console.log("🌱 Seeding database...");

  // Idempotent: wipe and recreate the demo user (bids cascade).
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

  const now = Date.now();
  const rows = [
    { itbFileName: "northside-elementary.pdf", projectName: "Northside Elementary — Electrical Renovation", gcName: "Turner Ridge Construction, LLC", ownerName: "Dallas Independent School District", primaryTrade: "electrical", status: "draft", bidDeadline: new Date(now + 3 * DAY) },
    { itbFileName: "municipal-water.pdf", projectName: "Municipal Water Treatment — Phase 2", gcName: "Ryan Companies", ownerName: "City of Dallas", primaryTrade: "plumbing", status: "in_review", bidDeadline: new Date(now + 1 * DAY) },
    { itbFileName: "retail-hvac.pdf", projectName: "Retail Center — HVAC Retrofit", gcName: "Hoar Construction", ownerName: "Weitzman Group", primaryTrade: "hvac", status: "submitted", bidDeadline: new Date(now + 21 * DAY) },
    { itbFileName: "airport-concourse.pdf", projectName: "Airport Concourse — Structural Steel", gcName: "Austin Commercial", ownerName: "DFW Airport Board", primaryTrade: "steel", status: "draft", bidDeadline: new Date(now - 2 * DAY) },
    { itbFileName: "warehouse-slab.pdf", projectName: "Warehouse Slab — No Deadline Listed", gcName: "Alston Construction", ownerName: "Prologis", primaryTrade: "concrete", status: "draft", bidDeadline: null },
  ];

  for (const row of rows) {
    await db.insert(bids).values({
      userId: user.id,
      ...row,
      extraction: DEMO_EXTRACTION,
      lineItems: DEMO_LINE_ITEMS,
      assumptions: [
        "All work is performed during normal business hours, Monday through Friday, 7:00 AM to 3:30 PM, excluding holidays.",
        "Temporary power, lighting, water, and toilet facilities are provided by the GC at no cost to us.",
        "The existing electrical service has adequate capacity for the new loads without upgrade.",
      ],
      clarifications: [
        "Has the existing electrical service capacity been verified as adequate for the new loads?",
        "What shutdown windows are available for tie-ins to the existing service?",
        "Is the lighting fixture package owner-furnished or contractor-furnished?",
      ],
      exclusions: [
        "Permits, permit fees, plan review fees, and impact fees.",
        "Payment and performance bonds (available at additional cost if required).",
        "Firestopping and fire-rated penetration sealing.",
        "Cutting, patching, and repair of finished surfaces.",
        "Low-voltage, data, security, and audiovisual systems and cabling.",
      ],
    });
  }

  console.log(`✅ Seeded ${rows.length} bids`);
  console.log(`   Log in as: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
