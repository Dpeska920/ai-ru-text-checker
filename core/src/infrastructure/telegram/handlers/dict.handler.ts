import type { BotContext } from "../bot";
import type { UserRepository } from "@/application/ports";
import { ManageDictionaryUseCase, type DictionaryAction } from "@/application/use-cases";
import { User } from "@/domain/entities";

export function createDictHandler(userRepository: UserRepository) {
  const useCase = new ManageDictionaryUseCase(userRepository);

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

    let action: DictionaryAction = "list";
    let word: string | undefined;

    if (parts.length > 1) {
      const subCommand = parts[1].toLowerCase();

      switch (subCommand) {
        case "add":
          action = "add";
          word = parts.slice(2).join(" ");
          break;
        case "remove":
        case "del":
        case "delete":
          action = "remove";
          word = parts.slice(2).join(" ");
          break;
        case "clear":
          action = "clear";
          break;
        default:
          action = "add";
          word = parts.slice(1).join(" ");
      }
    }

    const result = await useCase.execute({ user, action, word });

    if (result.isFailure) {
      await ctx.reply(`Error: ${result.getErrorValue()}`);
      return;
    }

    await ctx.reply(result.getValue().message);
  };
}
