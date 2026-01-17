import type { SearchClient, SearchResult } from "@/application/ports";

export interface SearchConfig {
  provider: "exa-mcp" | "mock";
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 2;

export class MCPSearchClient implements SearchClient {
  private readonly provider: string;
  private readonly mcpUrl = "https://mcp.exa.ai/mcp";
  private sessionId: string | null = null;
  private lastRequestTime = 0;

  constructor(config?: SearchConfig) {
    this.provider = config?.provider ?? process.env.SEARCH_PROVIDER ?? "exa-mcp";
  }

  async search(query: string): Promise<SearchResult[]> {
    console.log(`[Search ${this.provider}] Query: ${query}`);

    if (this.provider === "mock") {
      return this.mockSearch(query);
    }

    return this.searchExaMCP(query);
  }

  private async searchExaMCP(query: string, retryCount = 0): Promise<SearchResult[]> {
    try {
      // Rate limiting - minimum 500ms between requests
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < 500) {
        await this.delay(500 - timeSinceLastRequest);
      }

      // Initialize session if needed
      if (!this.sessionId) {
        await this.initSession();
      }

      this.lastRequestTime = Date.now();

      const response = await fetch(this.mcpUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.sessionId ? { "mcp-session-id": this.sessionId } : {}),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: {
            name: "web_search_exa",
            arguments: {
              query,
              numResults: 3,
            },
          },
        }),
      });

      // Handle session ID from response
      const newSessionId = response.headers.get("mcp-session-id");
      if (newSessionId) {
        this.sessionId = newSessionId;
      }

      // Handle 406 - session expired or rate limited
      if (response.status === 406) {
        console.warn(`[Exa MCP] HTTP 406 - resetting session and retrying...`);
        this.sessionId = null;

        if (retryCount < MAX_RETRIES) {
          await this.delay(RETRY_DELAY_MS * (retryCount + 1));
          return this.searchExaMCP(query, retryCount + 1);
        }

        console.error(`[Exa MCP] Max retries reached for query: ${query}`);
        return [];
      }

      if (!response.ok) {
        console.error(`[Exa MCP] HTTP Error: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as MCPResponse;

      if (data.error) {
        console.error(`[Exa MCP] Error: ${data.error.message}`);
        return [];
      }

      if (!data.result?.content?.[0]?.text) {
        console.log("[Exa MCP] No results");
        return [];
      }

      return this.parseExaResponse(data.result.content[0].text);
    } catch (error) {
      console.error("[Exa MCP] Search failed:", error);
      return [];
    }
  }

  private async initSession(): Promise<void> {
    try {
      console.log("[Exa MCP] Initializing session...");

      const response = await fetch(this.mcpUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "redpen-core",
              version: "1.0.0",
            },
          },
        }),
      });

      const sessionId = response.headers.get("mcp-session-id");
      if (sessionId) {
        this.sessionId = sessionId;
        console.log("[Exa MCP] Session initialized successfully");
      } else {
        console.warn("[Exa MCP] No session ID received");
      }
    } catch (error) {
      console.error("[Exa MCP] Init failed:", error);
    }
  }

  private parseExaResponse(text: string): SearchResult[] {
    const results: SearchResult[] = [];

    const blocks = text.split(/\n\nTitle:/);

    for (const block of blocks) {
      if (!block.trim()) continue;

      const fullBlock = block.startsWith("Title:") ? block : `Title:${block}`;

      const titleMatch = fullBlock.match(/Title:\s*(.+?)(?:\n|$)/);
      const urlMatch = fullBlock.match(/URL:\s*(.+?)(?:\n|$)/);
      const textMatch = fullBlock.match(/Text:\s*([\s\S]+?)(?=\n\nTitle:|$)/);

      if (titleMatch && urlMatch) {
        results.push({
          title: titleMatch[1].trim(),
          url: urlMatch[1].trim(),
          snippet: textMatch?.[1]?.trim().substring(0, 500) || "",
        });
      }
    }

    return results.slice(0, 3);
  }

  private mockSearch(query: string): SearchResult[] {
    console.log(`[Mock Search] Would search for: ${query}`);
    return [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
