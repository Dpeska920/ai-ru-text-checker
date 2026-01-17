import type { Redis } from "ioredis";
import type { JobRepository } from "@/application/ports";
import { Job, type JobProps } from "@/domain/entities";

const JOB_PREFIX = "job:";
const USER_JOBS_PREFIX = "user_jobs:";
const JOB_TTL = 60 * 60 * 24; // 24 hours

export class RedisJobRepository implements JobRepository {
  constructor(private readonly redis: Redis) {}

  async findById(id: string): Promise<Job | null> {
    const data = await this.redis.get(`${JOB_PREFIX}${id}`);
    if (!data) return null;

    return this.deserialize(data);
  }

  async findByUserId(userId: number): Promise<Job[]> {
    const jobIds = await this.redis.smembers(`${USER_JOBS_PREFIX}${userId}`);
    if (jobIds.length === 0) return [];

    const pipeline = this.redis.pipeline();
    for (const id of jobIds) {
      pipeline.get(`${JOB_PREFIX}${id}`);
    }

    const results = await pipeline.exec();
    if (!results) return [];

    return results
      .map(([, data]) => (data ? this.deserialize(data as string) : null))
      .filter((job): job is Job => job !== null);
  }

  async save(job: Job): Promise<void> {
    const pipeline = this.redis.pipeline();

    pipeline.set(
      `${JOB_PREFIX}${job.id}`,
      JSON.stringify(job.toJSON()),
      "EX",
      JOB_TTL
    );

    pipeline.sadd(`${USER_JOBS_PREFIX}${job.userId}`, job.id);
    pipeline.expire(`${USER_JOBS_PREFIX}${job.userId}`, JOB_TTL);

    await pipeline.exec();
  }

  async delete(id: string): Promise<void> {
    const job = await this.findById(id);
    if (!job) return;

    const pipeline = this.redis.pipeline();
    pipeline.del(`${JOB_PREFIX}${id}`);
    pipeline.srem(`${USER_JOBS_PREFIX}${job.userId}`, id);
    await pipeline.exec();
  }

  private deserialize(data: string): Job {
    const props = JSON.parse(data) as JobProps;
    props.createdAt = new Date(props.createdAt);
    if (props.completedAt) {
      props.completedAt = new Date(props.completedAt);
    }
    return Job.fromPersistence(props);
  }
}
