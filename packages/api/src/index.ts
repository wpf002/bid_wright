import { loadEnv } from "./env";

/** Flags default on; only an explicit false/0/no/off turns one off. */
function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return !["false", "0", "no", "off"].includes(raw.toLowerCase());
}

function envNumber(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

const HOUR = 60 * 60 * 1000;

async function main() {
  // Must run before ./app is loaded: @bidwright/db reads DATABASE_URL when it's
  // imported, so this import stays dynamic.
  loadEnv();

  const { buildApp } = await import("./app");
  const app = await buildApp({ logger: true });

  // Started here rather than in buildApp: tests build the app directly, and a
  // job that deletes files should not be one import away from firing inside a
  // test run.
  //
  // Before listen(), because Fastify refuses addHook once the server is
  // listening. Nothing is swept during startup regardless — the first run is a
  // timer away, not immediate.
  if (envFlag("STORAGE_SWEEP_ENABLED", true)) {
    const { startStorageSweeper } = await import("./storage/scheduler");
    const sweeper = startStorageSweeper({
      log: app.log,
      intervalMs: envNumber("STORAGE_SWEEP_INTERVAL_HOURS", 24) * HOUR,
      initialDelayMs: envNumber("STORAGE_SWEEP_INITIAL_DELAY_HOURS", 1) * HOUR,
      retention: envFlag("STORAGE_SWEEP_RETENTION_ENABLED", true),
      retentionDays: envNumber("SUPPORTING_RETENTION_DAYS", 180),
    });
    app.addHook("onClose", async () => sweeper.stop());
  } else {
    app.log.info("storage sweep disabled (STORAGE_SWEEP_ENABLED=false)");
  }

  // Railway (and most PaaS) inject PORT and route the public domain to it;
  // API_PORT stays the local-dev knob.
  const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`🚀 BidWright API listening on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
