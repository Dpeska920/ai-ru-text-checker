import type { BotContext } from "../bot";
import type { UserRepository, LLMClient, WorkerClient, SearchClient, SpellCheckClient } from "@/application/ports";
import { ProcessTextUseCase } from "@/application/use-cases";
import { User } from "@/domain/entities";
import { InputFile } from "grammy";

const PROCESSING_MESSAGE = "Обрабатываю текст...";
const NO_CHANGES_MESSAGE = "Текст не требует исправлений.";

export function createTextHandler(
  userRepository: UserRepository,
  llmClient: LLMClient,
  workerClient: WorkerClient,
  searchClient: SearchClient,
  spellCheckClient?: SpellCheckClient
) {
  const useCase = new ProcessTextUseCase(llmClient, workerClient, searchClient, spellCheckClient);

  return async (ctx: BotContext) => {
    const telegramId = ctx.from?.id;
    const text = ctx.message?.text;

    console.log(`[TextHandler] Received message from user ${telegramId}: "${text?.substring(0, 50)}..."`);

    if (!telegramId || !text) {
      console.log("[TextHandler] No telegramId or text, skipping");
      return;
    }

    let user = await userRepository.findByTelegramId(telegramId);
    if (!user) {
      user = User.create({ telegramId });
      await userRepository.save(user);
    }

    const statusMessage = await ctx.reply(PROCESSING_MESSAGE);
    console.log(`[TextHandler] Processing text for user ${telegramId}, length: ${text.length}`);

    try {
      console.log("[TextHandler] Calling ProcessTextUseCase...");
      const result = await useCase.execute({ user, text });
      console.log(`[TextHandler] UseCase result: isFailure=${result.isFailure}`);

      if (result.isFailure) {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          statusMessage.message_id,
          `Ошибка: ${result.getErrorValue()}`
        );
        return;
      }

      const response = result.getValue();

      if (!response.hasChanges) {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          statusMessage.message_id,
          NO_CHANGES_MESSAGE
        );
        return;
      }

      await ctx.api.deleteMessage(ctx.chat!.id, statusMessage.message_id);

      await ctx.reply(response.correctedText);

      if (response.factChanges.length > 0) {
        const factMessage = formatFactChanges(response.factChanges);
        try {
          await ctx.reply(factMessage, { parse_mode: "HTML" });
        } catch {
          await ctx.reply(factMessage.replace(/<[^>]+>/g, ""));
        }
      }

      if (response.diffDoc) {
        await ctx.replyWithDocument(
          new InputFile(response.diffDoc, "changes.docx"),
          { caption: "Файл с изменениями" }
        );
      }
    } catch (error) {
      console.error("Text processing error:", error);
      try {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          statusMessage.message_id,
          "Произошла ошибка при обработке текста. Попробуйте позже."
        );
      } catch {
        await ctx.reply("Произошла ошибка при обработке текста. Попробуйте позже.");
      }
    }
  };
}

function formatFactChanges(changes: Array<{ original: string; corrected: string; context: string; source?: string }>): string {
  const lines = ["<b>Исправлены фактические ошибки:</b>\n"];

  for (const change of changes) {
    const original = escapeHtml(change.original);
    const corrected = escapeHtml(change.corrected);
    lines.push(`• <s>${original}</s> → <b>${corrected}</b>`);
    if (change.source) {
      lines.push(`  Источник: ${escapeHtml(change.source)}`);
    }
  }

  return lines.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
