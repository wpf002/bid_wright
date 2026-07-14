import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import jwt from "@fastify/jwt";
import { bidRoutes } from "./routes/bids";
import { uploadRoutes } from "./routes/uploads";
import { authRoutes } from "./routes/auth";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart, {
  limits: { fileSize: 50 * 1024 * 1024 },
});
await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? "dev-only-change-me-min-32-chars-1234",
});

app.get("/health", async () => ({ status: "ok", service: "bidwright-api" }));

await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(bidRoutes, { prefix: "/api/bids" });
await app.register(uploadRoutes, { prefix: "/api/uploads" });

const PORT = Number(process.env.API_PORT ?? 4000);
app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) { app.log.error(err); process.exit(1); }
  console.log(`🚀 BidWright API listening on http://localhost:${PORT}`);
});
