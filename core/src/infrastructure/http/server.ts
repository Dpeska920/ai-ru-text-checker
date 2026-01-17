import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { SERVER } from "@/config";

export function createServer() {
  const app = new Hono();

  if (SERVER.IS_DEV) {
    app.use("*", logger());
  }

  app.use("*", cors());

  app.get("/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return app;
}
