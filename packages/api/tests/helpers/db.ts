import { randomUUID } from "node:crypto";

/**
 * Integration tests need a real Postgres. `bash scripts/dev.sh` or
 * `docker compose up -d` provides it. When DATABASE_URL isn't reachable we skip
 * rather than fail, but we never silently pass a suite that was supposed to run
 * against a DB — the skip is visible in the vitest output.
 */
export const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://bidwright:bidwright@localhost:5433/bidwright";

export async function isDatabaseReachable(): Promise<boolean> {
  try {
    const postgres = (await import("postgres")).default;
    const sql = postgres(TEST_DATABASE_URL, { max: 1, connect_timeout: 2 });
    await sql`select 1`;
    await sql.end();
    return true;
  } catch {
    return false;
  }
}

/** A unique email so parallel/repeat runs never collide. */
export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${randomUUID()}@example.com`;
}
