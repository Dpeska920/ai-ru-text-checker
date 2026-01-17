import { WORKER } from "@/config";
import type { WorkerClient, ParseResult, GenerateResult } from "@/application/ports";
import type { InputFormat, FactChange } from "@/domain/entities";
import { ExternalServiceError } from "@/shared/core";

interface ParseResponse {
  text: string;
  error: string | null;
}

interface GenerateResponse {
  clean_doc: string;
  diff_doc: string;
  error: string | null;
}

export class HttpWorkerClient implements WorkerClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? WORKER.URL;
  }

  async parseFile(content: Buffer, fileType: InputFormat): Promise<ParseResult> {
    const response = await fetch(`${this.baseUrl}/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_content: content.toString("base64"),
        file_type: fileType,
      }),
    });

    if (!response.ok) {
      throw new ExternalServiceError("Worker", `HTTP ${response.status}`);
    }

    const data = (await response.json()) as ParseResponse;
    return {
      text: data.text,
      error: data.error ?? undefined,
    };
  }

  async generateDocuments(
    original: string,
    corrected: string,
    factChanges?: FactChange[]
  ): Promise<GenerateResult> {
    const response = await fetch(`${this.baseUrl}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        original,
        corrected,
        fact_changes: factChanges?.map((fc) => ({
          original: fc.original,
          corrected: fc.corrected,
          context: fc.context,
        })),
      }),
    });

    if (!response.ok) {
      throw new ExternalServiceError("Worker", `HTTP ${response.status}`);
    }

    const data = (await response.json()) as GenerateResponse;

    if (data.error) {
      return {
        cleanDoc: Buffer.alloc(0),
        diffDoc: Buffer.alloc(0),
        error: data.error,
      };
    }

    return {
      cleanDoc: Buffer.from(data.clean_doc, "base64"),
      diffDoc: Buffer.from(data.diff_doc, "base64"),
    };
  }
}
