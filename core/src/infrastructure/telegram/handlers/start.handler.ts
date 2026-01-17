import type { BotContext } from "../bot";
import type { UserRepository } from "@/application/ports";
import { User } from "@/domain/entities";

const WELCOME_MESSAGE = `Привет! Я *Красная Ручка* - бот для проверки текстов на русском языке.

*Что я умею:*
- Исправлять грамматические и орфографические ошибки
- Проверять пунктуацию
- Находить фактические ошибки
- При этом сохранять ваш авторский стиль

*Как пользоваться:*
1. Отправьте мне текст или файл (docx, pdf, txt)
2. Получите исправленный текст и файл с изменениями

*Команды:*
/help - справка по командам
/dict - управление личным словарём
/settings - настройки`;

export function createStartHandler(userRepository: UserRepository) {
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

    await ctx.reply(WELCOME_MESSAGE, { parse_mode: "Markdown" });
  };
}
