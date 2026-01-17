import type { Redis } from "ioredis";
import type { UserRepository } from "@/application/ports";
import { User, type UserProps } from "@/domain/entities";

const USER_PREFIX = "user:";

export class RedisUserRepository implements UserRepository {
  constructor(private readonly redis: Redis) {}

  async findByTelegramId(telegramId: number): Promise<User | null> {
    const data = await this.redis.get(`${USER_PREFIX}${telegramId}`);
    if (!data) return null;

    const props = JSON.parse(data) as UserProps;
    props.createdAt = new Date(props.createdAt);
    return User.fromPersistence(props);
  }

  async save(user: User): Promise<void> {
    await this.redis.set(
      `${USER_PREFIX}${user.telegramId}`,
      JSON.stringify(user.toJSON())
    );
  }
}
