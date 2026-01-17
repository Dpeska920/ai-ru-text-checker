import type { UseCase } from "@/shared/core";
import { Result } from "@/shared/core";
import type { ProcessTextRequest, ProcessTextResponse } from "./process-text.dto";
import type { LLMClient, LLMMessage, WorkerClient, SearchClient, SpellCheckClient } from "@/application/ports";
import type { FactChange } from "@/domain/entities";
import {
  buildCorrectorPrompt,
  buildFactCheckPrompt,
  buildVerifierPrompt,
  WEB_SEARCH_TOOL,
  VERIFIER_SYSTEM_PROMPT,
} from "./prompts";
import { ChunkService, type TextChunk } from "@/application/services";

const MAX_TOOL_CALLS = 5;
const PARALLEL_CHUNK_LIMIT = 5;

interface FactCheckResult {
  corrections: FactChange[];
  finalText: string;
}

interface ChunkResult {
  index: number;
  corrected: string;
  success: boolean;
}

export class ProcessTextUseCase implements UseCase<ProcessTextRequest, ProcessTextResponse> {
  private readonly chunkService: ChunkService;

  constructor(
    private readonly llmClient: LLMClient,
    private readonly workerClient: WorkerClient,
    private readonly searchClient: SearchClient,
    private readonly spellCheckClient?: SpellCheckClient
  ) {
    this.chunkService = new ChunkService(5);
  }

  async execute(request: ProcessTextRequest): Promise<Result<ProcessTextResponse>> {
    const { user, text, file } = request;
    console.log(`[ProcessText] Starting execution, text length: ${text?.length}, hasFile: ${!!file}`);

    let originalText = text ?? "";

    if (file) {
      console.log(`[ProcessText] Parsing file, format: ${file.format}`);
      const parseResult = await this.workerClient.parseFile(file.content, file.format);
      if (parseResult.error) {
        console.error(`[ProcessText] File parse error: ${parseResult.error}`);
        return Result.fail(`Failed to parse file: ${parseResult.error}`);
      }
      originalText = parseResult.text;
      console.log(`[ProcessText] File parsed, text length: ${originalText.length}`);
    }

    if (!originalText.trim()) {
      console.log("[ProcessText] Text is empty, returning error");
      return Result.fail("Text is empty");
    }

    // === PASS 0: LanguageTool spell-check (offline, fast) ===
    let afterPass0 = originalText;
    if (this.spellCheckClient) {
      console.log("[ProcessText] === PASS 0: LanguageTool spell-check ===");
      const pass0Result = await this.spellCheckClient.check(originalText, "ru");
      afterPass0 = pass0Result.correctedText;
      console.log(`[ProcessText] Pass 0 complete, ${pass0Result.matches.length} issues fixed`);
    } else {
      console.log("[ProcessText] === PASS 0: Skipped (no spell-checker) ===");
    }

    // === PASS 1: LLM Chunked correction (parallel) ===
    console.log("[ProcessText] === PASS 1: LLM Chunked correction ===");
    const pass1Result = await this.correctGrammarChunked(
      afterPass0,
      user.dictionary,
      user.globalPrompt
    );

    if (pass1Result.isFailure) {
      console.error(`[ProcessText] Pass 1 failed: ${pass1Result.getErrorValue()}`);
      return Result.fail(pass1Result.getErrorValue());
    }

    const afterPass1 = pass1Result.getValue();
    console.log(`[ProcessText] Pass 1 complete, result length: ${afterPass1.length}`);

    // === PASS 2: Full verification (original vs corrected) ===
    console.log("[ProcessText] === PASS 2: Verification ===");
    const pass2Result = await this.verifyCorrections(originalText, afterPass1);

    let correctedText = pass2Result.isSuccess ? pass2Result.getValue() : afterPass1;
    console.log(`[ProcessText] Pass 2 complete, result length: ${correctedText.length}`);

    // === PASS 3: Fact checking ===
    console.log("[ProcessText] === PASS 3: Fact check ===");
    const factCheckResult = await this.factCheck(correctedText);
    let factChanges: FactChange[] = [];

    if (factCheckResult.isSuccess) {
      const fcResult = factCheckResult.getValue();
      factChanges = fcResult.corrections;
      if (fcResult.finalText) {
        correctedText = fcResult.finalText;
      }
    }

    const hasChanges = originalText !== correctedText || factChanges.length > 0;

    if (!hasChanges) {
      return Result.ok({
        correctedText: originalText,
        hasChanges: false,
        factChanges: [],
      });
    }

    const generateResult = await this.workerClient.generateDocuments(
      originalText,
      correctedText,
      factChanges
    );

    if (generateResult.error) {
      return Result.ok({
        correctedText,
        hasChanges: true,
        factChanges,
      });
    }

    return Result.ok({
      correctedText,
      hasChanges: true,
      factChanges,
      cleanDoc: generateResult.cleanDoc,
      diffDoc: generateResult.diffDoc,
    });
  }

  private async correctGrammarChunked(
    text: string,
    dictionary: string[],
    userPrompt?: string
  ): Promise<Result<string>> {
    const chunks = this.chunkService.splitIntoChunks(text);
    console.log(`[ProcessText] Split into ${chunks.length} chunks`);

    if (chunks.length === 1) {
      return this.correctSingleChunk(chunks[0].text, dictionary, userPrompt);
    }

    const results = new Map<number, string>();
    const errors: string[] = [];

    for (let i = 0; i < chunks.length; i += PARALLEL_CHUNK_LIMIT) {
      const batch = chunks.slice(i, i + PARALLEL_CHUNK_LIMIT);
      console.log(`[ProcessText] Processing batch ${i / PARALLEL_CHUNK_LIMIT + 1}, chunks: ${batch.map(c => c.index).join(", ")}`);

      const batchResults = await Promise.all(
        batch.map(chunk => this.processChunk(chunk, dictionary, userPrompt))
      );

      for (const result of batchResults) {
        if (result.success) {
          results.set(result.index, result.corrected);
        } else {
          errors.push(`Chunk ${result.index} failed`);
          const originalChunk = chunks.find(c => c.index === result.index);
          if (originalChunk) {
            results.set(result.index, originalChunk.text);
          }
        }
      }
    }

    if (errors.length > 0) {
      console.warn(`[ProcessText] Some chunks failed: ${errors.join(", ")}`);
    }

    const reassembled = this.chunkService.reassembleText(chunks, results);
    return Result.ok(reassembled);
  }

  private async processChunk(
    chunk: TextChunk,
    dictionary: string[],
    userPrompt?: string
  ): Promise<ChunkResult> {
    try {
      const result = await this.correctSingleChunk(chunk.text, dictionary, userPrompt);
      if (result.isFailure) {
        return { index: chunk.index, corrected: chunk.text, success: false };
      }
      return { index: chunk.index, corrected: result.getValue(), success: true };
    } catch (error) {
      console.error(`[ProcessText] Chunk ${chunk.index} error: ${error}`);
      return { index: chunk.index, corrected: chunk.text, success: false };
    }
  }

  private async correctSingleChunk(
    text: string,
    dictionary: string[],
    userPrompt?: string
  ): Promise<Result<string>> {
    const systemPrompt = buildCorrectorPrompt(dictionary, userPrompt);

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ];

    try {
      const response = await this.llmClient.chat(messages);
      if (!response.content) {
        return Result.fail("LLM returned empty response");
      }
      return Result.ok(response.content);
    } catch (error) {
      return Result.fail(`Grammar correction failed: ${error}`);
    }
  }

  private async verifyCorrections(original: string, corrected: string): Promise<Result<string>> {
    if (original === corrected) {
      return Result.ok(corrected);
    }

    const messages: LLMMessage[] = [
      { role: "system", content: VERIFIER_SYSTEM_PROMPT },
      { role: "user", content: buildVerifierPrompt(original, corrected) },
    ];

    try {
      console.log("[ProcessText] Sending to LLM for verification...");
      const response = await this.llmClient.chat(messages);

      if (!response.content) {
        console.warn("[ProcessText] Verification returned empty, using pass 1 result");
        return Result.ok(corrected);
      }

      console.log(`[ProcessText] Verification complete, changes applied`);
      return Result.ok(response.content);
    } catch (error) {
      console.warn(`[ProcessText] Verification failed (non-critical): ${error}`);
      return Result.ok(corrected);
    }
  }

  private async factCheck(text: string): Promise<Result<FactCheckResult>> {
    const systemPrompt = buildFactCheckPrompt();

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ];

    try {
      let response = await this.llmClient.chat(messages, [WEB_SEARCH_TOOL]);
      let toolCallCount = 0;

      while (response.tool_calls && response.tool_calls.length > 0 && toolCallCount < MAX_TOOL_CALLS) {
        const toolResults: Array<{ tool_call_id: string; content: string }> = [];

        for (const toolCall of response.tool_calls) {
          if (toolCall.function.name === "web_search") {
            const args = JSON.parse(toolCall.function.arguments);
            console.log(`[ProcessText] Fact-check searching: ${args.query}`);
            const searchResults = await this.searchClient.search(args.query);

            const searchResponse = searchResults.length > 0
              ? searchResults.map(r => `${r.title}: ${r.snippet} (${r.url})`).join("\n")
              : "No results found";

            toolResults.push({
              tool_call_id: toolCall.id,
              content: searchResponse,
            });
          }
        }

        messages.push({
          role: "assistant",
          content: "",
          tool_calls: response.tool_calls,
        });

        for (const result of toolResults) {
          messages.push({
            role: "tool",
            content: result.content,
            tool_call_id: result.tool_call_id,
          });
        }

        toolCallCount++;
        response = await this.llmClient.chat(messages, [WEB_SEARCH_TOOL]);
      }

      if (!response.content) {
        return Result.ok({ corrections: [], finalText: text });
      }

      const parsed = this.parseFactCheckResponse(response.content);
      return Result.ok(parsed);
    } catch (error) {
      console.warn(`Fact check failed (non-critical): ${error}`);
      return Result.ok({ corrections: [], finalText: text });
    }
  }

  private parseFactCheckResponse(content: string): FactCheckResult {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { corrections: [], finalText: "" };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
        finalText: parsed.finalText || "",
      };
    } catch {
      return { corrections: [], finalText: "" };
    }
  }
}
