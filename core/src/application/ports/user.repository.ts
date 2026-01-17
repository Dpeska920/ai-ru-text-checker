import type { User } from "@/domain/entities";

export interface UserRepository {
  findByTelegramId(telegramId: number): Promise<User | null>;
  save(user: User): Promise<void>;
}
