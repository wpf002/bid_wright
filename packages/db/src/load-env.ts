import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";

/**
 * Load the monorepo's .env by walking up from the cwd.
 *
 * The db scripts run with cwd = packages/db but the .env lives at the repo
 * root, so nothing is loaded by default and DATABASE_URL comes back undefined.
 * Returns the directory the .env was found in — the seed resolves UPLOAD_DIR
 * against it.
 */
export function loadRootEnv(): string {
  let dir = process.cwd();
  for (;;) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) {
      config({ path: candidate });
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}
