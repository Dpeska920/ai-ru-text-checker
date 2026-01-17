import type { InputFormat, FactChange } from "@/domain/entities";

export interface ParseResult {
  text: string;
  error?: string;
}

export interface GenerateResult {
  cleanDoc: Buffer;
  diffDoc: Buffer;
  error?: string;
}

export interface WorkerClient {
  parseFile(content: Buffer, fileType: InputFormat): Promise<ParseResult>;
  generateDocuments(
    original: string,
    corrected: string,
    factChanges?: FactChange[]
  ): Promise<GenerateResult>;
}
