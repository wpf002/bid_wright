import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";

/**
 * Load the monorepo's root .env.
 *
 * `npm run api:dev` runs with cwd = packages/api, so plain `dotenv/config`
 * looks for packages/api/.env and silently finds nothing — leaving DATABASE_URL
 * unset and crashing the db client at import. Walk up to the real .env instead.
 *
 * Must be called before anything that reads env at module load (@bidwright/db
 * builds its Postgres client on import), so callers import those dynamically.
 */
export function loadEnv(startDir: string = process.cwd()): string | null {
  let dir = startDir;
  for (;;) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) {
      config({ path: candidate });
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // No .env anywhere (e.g. CI, or real env vars already exported) — rely on
  // whatever the process was given.
  return null;
}
