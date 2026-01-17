import type { BotContext } from "../bot";
import type { UserRepository } from "@/application/ports";
import { User } from "@/domain/entities";

export function createSettingsHandler(userRepository: UserRepository) {
  return async (ctx: BotContext) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      return;
    }

    let user = await userRepository.findByTelegramId(telegramId);
    if (!user) {
      user = User.create({ telegramId });
      await userRepository.save(user);
    }

    const text = ctx.message?.text ?? "";
    const parts = text.split(/\s+/).filter(Boolean);

    if (parts.length < 2) {
      const currentPrompt = user.globalPrompt;
      const message = currentPrompt
        ? `*Текущие настройки:*\n\nДополнительные инструкции:\n\`${currentPrompt}\`\n\nДля изменения: \`/settings prompt <инструкция>\`\nДля сброса: \`/settings prompt\``
        : `*Текущие настройки:*\n\nДополнительные инструкции: (не заданы)\n\nДля установки: \`/settings prompt <инструкция>\``;

      await ctx.reply(message, { parse_mode: "Markdown" });
      return;
    }

    const subCommand = parts[1].toLowerCase();

    if (subCommand === "prompt") {
      const prompt = parts.slice(2).join(" ").trim() || undefined;
      const updatedUser = user.updateGlobalPrompt(prompt);
      await userRepository.save(updatedUser);

      if (prompt) {
        await ctx.reply(`Дополнительные инструкции установлены:\n\`${prompt}\``, {
          parse_mode: "Markdown",
        });
      } else {
        await ctx.reply("Дополнительные инструкции сброшены.");
      }
      return;
    }

    await ctx.reply(
      "Неизвестная команда. Используйте:\n" +
        "`/settings` - показать настройки\n" +
        "`/settings prompt <текст>` - установить инструкции\n" +
        "`/settings prompt` - сбросить инструкции",
      { parse_mode: "Markdown" }
    );
  };
}
