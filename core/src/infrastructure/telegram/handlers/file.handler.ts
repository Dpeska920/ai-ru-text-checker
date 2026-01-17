import type { BotContext } from "../bot";
import type { UserRepository, LLMClient, WorkerClient, SearchClient, SpellCheckClient } from "@/application/ports";
import { ProcessTextUseCase } from "@/application/use-cases";
import { User, type InputFormat } from "@/domain/entities";
import { InputFile } from "grammy";

const SUPPORTED_EXTENSIONS: Record<string, InputFormat> = {
  ".docx": "docx",
  ".doc": "doc",
  ".pdf": "pdf",
  ".txt": "txt",
  ".md": "md",
};

const PROCESSING_MESSAGE = "Обрабатываю файл...";
const NO_CHANGES_MESSAGE = "Документ не требует исправлений.";

export function createFileHandler(
  userRepository: UserRepository,
  llmClient: LLMClient,
  workerClient: WorkerClient,
  searchClient: SearchClient,
  spellCheckClient?: SpellCheckClient
) {
  const useCase = new ProcessTextUseCase(llmClient, workerClient, searchClient, spellCheckClient);

  return async (ctx: BotContext) => {
    const telegramId = ctx.from?.id;
    const document = ctx.message?.document;

    if (!telegramId || !document) {
      return;
    }

    const fileName = document.file_name ?? "";
    const extension = getFileExtension(fileName);
    const format = SUPPORTED_EXTENSIONS[extension];

    if (!format) {
      await ctx.reply(
        `Неподдерживаемый формат файла. Поддерживаются: ${Object.keys(SUPPORTED_EXTENSIONS).join(", ")}`
      );
      return;
    }

    let user = await userRepository.findByTelegramId(telegramId);
    if (!user) {
      user = User.create({ telegramId });
      await userRepository.save(user);
    }

    const statusMessage = await ctx.reply(PROCESSING_MESSAGE);

    try {
      const file = await ctx.getFile();
      const fileBuffer = await downloadFile(file.file_path!);

      const result = await useCase.execute({
        user,
        file: {
          content: fileBuffer,
          format,
        },
      });

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

      if (response.cleanDoc) {
        const baseName = fileName.replace(/\.[^.]+$/, "");
        await ctx.replyWithDocument(
          new InputFile(response.cleanDoc, `${baseName}_corrected.docx`),
          { caption: "Исправленный документ" }
        );
      }

      if (response.diffDoc) {
        const baseName = fileName.replace(/\.[^.]+$/, "");
        await ctx.replyWithDocument(
          new InputFile(response.diffDoc, `${baseName}_changes.docx`),
          { caption: "Документ с изменениями" }
        );
      }

      if (response.factChanges.length > 0) {
        const factMessage = formatFactChanges(response.factChanges);
        try {
          await ctx.reply(factMessage, { parse_mode: "HTML" });
        } catch {
          await ctx.reply(factMessage.replace(/<[^>]+>/g, ""));
        }
      }
    } catch (error) {
      console.error("File processing error:", error);
      try {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          statusMessage.message_id,
          "Произошла ошибка при обработке файла. Попробуйте позже."
        );
      } catch {
        await ctx.reply("Произошла ошибка при обработке файла. Попробуйте позже.");
      }
    }
  };
}

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) return "";
  return fileName.slice(lastDot).toLowerCase();
}

async function downloadFile(filePath: string): Promise<Buffer> {
  const token = process.env.TG_TOKEN;
  const url = `https://api.telegram.org/file/bot${token}/${filePath}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
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
