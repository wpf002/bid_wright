import { db } from "../client";

async function seed() {
  console.log("🌱 Seeding database...");
  console.log("✅ Seed complete");
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
