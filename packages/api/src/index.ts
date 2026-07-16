import "dotenv/config";
import { buildApp } from "./app";

async function main() {
  const app = await buildApp({ logger: true });
  const PORT = Number(process.env.API_PORT ?? 4000);
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`🚀 BidWright API listening on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
