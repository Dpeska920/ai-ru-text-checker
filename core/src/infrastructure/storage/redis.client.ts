import Redis from "ioredis";
import { REDIS } from "@/config";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS.URL);

    redisClient.on("error", (err) => {
      console.error("Redis connection error:", err);
    });

    redisClient.on("connect", () => {
      console.log("Connected to Redis");
    });
  }

  return redisClient;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
