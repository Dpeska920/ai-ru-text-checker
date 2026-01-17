import { LLM } from "@/config";
import type { LLMClient, LLMMessage, LLMResponse, LLMTool } from "@/application/ports";
import { ExternalServiceError } from "@/shared/core";

interface OpenAIRequest {
  model: string;
  messages: LLMMessage[];
  tools?: LLMTool[];
}

interface OpenAIChoice {
  message: {
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: {
        name: string;
        arguments: string;
      };
    }>;
  };
}

interface OpenAIResponse {
  choices: OpenAIChoice[];
}

export class OpenAICompatibleClient implements LLMClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;

  constructor(config?: { baseUrl?: string; model?: string; apiKey?: string }) {
    this.baseUrl = config?.baseUrl ?? LLM.BASE_URL;
    this.model = config?.model ?? LLM.MODEL;
    this.apiKey = config?.apiKey ?? LLM.API_KEY;
  }

  async chat(messages: LLMMessage[], tools?: LLMTool[]): Promise<LLMResponse> {
    console.log(`[LLM] Sending request, model: ${this.model}, messages: ${messages.length}`);

    const body: OpenAIRequest = {
      model: this.model,
      messages,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
      console.log(`[LLM] With tools: ${tools.map(t => t.function.name).join(", ")}`);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    console.log(`[LLM] Making HTTP POST request...`);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    console.log(`[LLM] Response status: ${response.status}`);

    if (!response.ok) {
      const error = await response.text();
      console.error(`[LLM] Error response: ${error}`);
      throw new ExternalServiceError("LLM", `HTTP ${response.status}: ${error}`);
    }

    const data = (await response.json()) as OpenAIResponse;

    if (!data.choices || data.choices.length === 0) {
      console.error("[LLM] No choices in response");
      throw new ExternalServiceError("LLM", "No choices in response");
    }

    const choice = data.choices[0];
    console.log(`[LLM] Response received, content length: ${choice.message.content?.length}, tool_calls: ${choice.message.tool_calls?.length ?? 0}`);

    return {
      content: choice.message.content,
      tool_calls: choice.message.tool_calls,
    };
  }
}
