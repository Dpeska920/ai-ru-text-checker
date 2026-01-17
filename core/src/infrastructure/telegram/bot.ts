import { Bot, type Context } from "grammy";
import { TELEGRAM } from "@/config";
import type { UserRepository, LLMClient, WorkerClient, SearchClient, SpellCheckClient } from "@/application/ports";
import {
  createStartHandler,
  createHelpHandler,
  createDictHandler,
  createSettingsHandler,
  createTextHandler,
  createFileHandler,
} from "./handlers";

export type BotContext = Context;

export interface BotDependencies {
  userRepository: UserRepository;
  llmClient: LLMClient;
  workerClient: WorkerClient;
  searchClient: SearchClient;
  spellCheckClient?: SpellCheckClient;
}

let bot: Bot<BotContext> | null = null;

function isUserAllowed(userId?: number, username?: string): boolean {
  const hasWhitelist = TELEGRAM.WHITELIST_IDS.length > 0 || TELEGRAM.WHITELIST_USERNAMES.length > 0;

  if (!hasWhitelist) {
    return true; // No whitelist = allow everyone
  }

  if (userId && TELEGRAM.WHITELIST_IDS.includes(userId)) {
    return true;
  }

  if (username && TELEGRAM.WHITELIST_USERNAMES.includes(username.toLowerCase())) {
    return true;
  }

  return false;
}

export function createBot(deps: BotDependencies): Bot<BotContext> {
  if (!TELEGRAM.TOKEN) {
    throw new Error("TG_TOKEN is required");
  }

  bot = new Bot<BotContext>(TELEGRAM.TOKEN);

  // Whitelist middleware
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    const username = ctx.from?.username;

    if (!isUserAllowed(userId, username)) {
      console.log(`[Whitelist] Blocked user: id=${userId}, username=${username}`);
      return; // Silently ignore
    }

    await next();
  });

  bot.command("start", createStartHandler(deps.userRepository));
  bot.command("help", createHelpHandler());
  bot.command("dict", createDictHandler(deps.userRepository));
  bot.command("dictionary", createDictHandler(deps.userRepository));
  bot.command("settings", createSettingsHandler(deps.userRepository));

  bot.on("message:document", createFileHandler(
    deps.userRepository,
    deps.llmClient,
    deps.workerClient,
    deps.searchClient,
    deps.spellCheckClient
  ));

  bot.on("message:text", createTextHandler(
    deps.userRepository,
    deps.llmClient,
    deps.workerClient,
    deps.searchClient,
    deps.spellCheckClient
  ));

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  return bot;
}

export function getBot(): Bot<BotContext> {
  if (!bot) {
    throw new Error("Bot not initialized. Call createBot() first.");
  }
  return bot;
}
