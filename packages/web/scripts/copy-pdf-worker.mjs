import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

/**
 * Copy pdf.js's worker into public/ so it's served as a static file.
 *
 * Referencing it with `new URL('pdfjs-dist/build/pdf.worker.min.mjs',
 * import.meta.url)` makes webpack pull a 1.3 MB minified bundle through its
 * parser on every build — that alone took the build from seconds to minutes and
 * spewed the whole worker into the log. Serving it from public/ keeps webpack
 * out of it entirely while still pinning the worker to the installed pdfjs-dist
 * version (a CDN copy would silently drift and then throw at runtime).
 *
 * Runs on predev/prebuild; copies only when the file is missing or stale, so
 * warm builds pay nothing.
 */

const require = createRequire(import.meta.url);
const here = path.dirname(url.fileURLToPath(import.meta.url));
const publicDir = path.join(here, "..", "public");

const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const dest = path.join(publicDir, "pdf.worker.min.mjs");

const srcStat = fs.statSync(src);
const destStat = fs.existsSync(dest) ? fs.statSync(dest) : null;

if (destStat && destStat.size === srcStat.size && destStat.mtimeMs >= srcStat.mtimeMs) {
  process.stdout.write("pdf worker already current\n");
  process.exit(0);
}

fs.mkdirSync(publicDir, { recursive: true });
fs.copyFileSync(src, dest);
process.stdout.write(`copied pdf worker (${(srcStat.size / 1024).toFixed(0)} KB) -> public/\n`);
