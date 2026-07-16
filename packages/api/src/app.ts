import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import jwt from "@fastify/jwt";
import { bidRoutes } from "./routes/bids";
import { uploadRoutes } from "./routes/uploads";
import { authRoutes } from "./routes/auth";
import { intelligenceRoutes } from "./routes/intelligence";

export interface BuildAppOptions {
  logger?: boolean;
  jwtSecret?: string;
}

/**
 * Build the configured app without binding a port, so tests can drive it with
 * app.inject().
 */
export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });
  await app.register(jwt, {
    secret: opts.jwtSecret ?? process.env.JWT_SECRET ?? "dev-only-change-me-min-32-chars-1234",
  });

  app.get("/health", async () => ({ status: "ok", service: "bidwright-api" }));

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(bidRoutes, { prefix: "/api/bids" });
  await app.register(uploadRoutes, { prefix: "/api/uploads" });
  await app.register(intelligenceRoutes, { prefix: "/api" });

  return app;
}
