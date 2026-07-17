import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { loadRootEnv } from "./load-env";

loadRootEnv();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not set — expected it in the repo-root .env");
  }

  const migrationClient = postgres(connectionString, { max: 1 });
  await migrate(drizzle(migrationClient), { migrationsFolder: "./src/migrations" });
  await migrationClient.end();
  console.log("✅ Migrations complete");
}

main().catch((err) => { console.error(err); process.exit(1); });
