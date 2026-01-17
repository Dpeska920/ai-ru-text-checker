import type { User } from "@/domain/entities";

export type DictionaryAction = "list" | "add" | "remove" | "clear";

export interface ManageDictionaryRequest {
  user: User;
  action: DictionaryAction;
  word?: string;
}

export interface ManageDictionaryResponse {
  dictionary: string[];
  message: string;
}
