import type { User, FactChange, InputFormat } from "@/domain/entities";

export interface ProcessTextRequest {
  user: User;
  text?: string;
  file?: {
    content: Buffer;
    format: InputFormat;
  };
}

export interface ProcessTextResponse {
  correctedText: string;
  hasChanges: boolean;
  factChanges: FactChange[];
  cleanDoc?: Buffer;
  diffDoc?: Buffer;
}
