import type { Job } from "@/domain/entities";

export interface JobRepository {
  findById(id: string): Promise<Job | null>;
  findByUserId(userId: number): Promise<Job[]>;
  save(job: Job): Promise<void>;
  delete(id: string): Promise<void>;
}
