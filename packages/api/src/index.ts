import { loadEnv } from "./env";

async function main() {
  // Must run before ./app is loaded: @bidwright/db reads DATABASE_URL when it's
  // imported, so this import stays dynamic.
  loadEnv();

  const { buildApp } = await import("./app");
  const app = await buildApp({ logger: true });

  const PORT = Number(process.env.API_PORT ?? 4000);
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`🚀 BidWright API listening on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
