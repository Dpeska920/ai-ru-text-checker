import { SERVER } from "@/config";
import { createServer } from "@/infrastructure/http";
import { createBot } from "@/infrastructure/telegram";
import {
  getRedisClient,
  closeRedisConnection,
  RedisUserRepository,
  RedisJobRepository,
} from "@/infrastructure/storage";
import { OpenAICompatibleClient } from "@/infrastructure/llm";
import { MCPSearchClient } from "@/infrastructure/mcp";
import { SearXNGClient, BraveSearchClient, UnifiedSearchClient } from "@/infrastructure/search";
import { HttpWorkerClient } from "@/infrastructure/worker";
import { HunspellYandexClient } from "@/infrastructure/spellcheck";

async function main() {
  console.log("Starting Red Pen Core Service...");

  const redis = getRedisClient();
  await redis.ping();
  console.log("Redis connected");

  const userRepository = new RedisUserRepository(redis);
  const jobRepository = new RedisJobRepository(redis);
  const llmClient = new OpenAICompatibleClient();

  // Search: SearXNG (self-hosted, unlimited) -> Brave -> Exa MCP
  const searchClient = new UnifiedSearchClient({
    providers: [
      new SearXNGClient(),
      new BraveSearchClient(),
      new MCPSearchClient(),
    ],
  });

  const workerClient = new HttpWorkerClient();

  // SpellCheck: Hunspell (local dictionary) + Yandex Speller (corrections)
  const spellCheckClient = new HunspellYandexClient();

  console.log("Dependencies initialized");

  const bot = createBot({
    userRepository,
    llmClient,
    workerClient,
    searchClient,
    spellCheckClient,
  });
  console.log("Telegram bot initialized");

  const app = createServer();
  console.log("HTTP server created");

  const server = Bun.serve({
    port: SERVER.PORT,
    hostname: SERVER.HOST,
    fetch: app.fetch,
  });

  console.log(`HTTP server listening on ${server.hostname}:${server.port}`);

  bot.start({
    onStart: (botInfo) => {
      console.log(`Telegram bot @${botInfo.username} started`);
    },
  });

  const shutdown = async () => {
    console.log("\nShutting down...");
    await bot.stop();
    await closeRedisConnection();
    server.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
