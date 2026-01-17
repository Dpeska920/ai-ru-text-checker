import type { SearchClient, SearchResult } from "@/application/ports";

interface SearXNGResult {
  title: string;
  url: string;
  content?: string;
  engine: string;
  score?: number;
}

interface SearXNGResponse {
  query: string;
  number_of_results: number;
  results: SearXNGResult[];
}

export interface SearXNGConfig {
  baseUrl?: string;
}

export class SearXNGClient implements SearchClient {
  private readonly baseUrl: string;

  constructor(config?: SearXNGConfig) {
    this.baseUrl = config?.baseUrl ?? process.env.SEARXNG_URL ?? "http://localhost:8080";
  }

  async search(query: string): Promise<SearchResult[]> {
    console.log("[SearXNG] Query: " + query);

    try {
      const url = new URL("/search", this.baseUrl);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      url.searchParams.set("categories", "general");
      url.searchParams.set("language", "ru-RU");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.error("[SearXNG] HTTP Error: " + response.status);
        return [];
      }

      const data = (await response.json()) as SearXNGResponse;
      console.log("[SearXNG] Found " + data.results.length + " results");

      const results: SearchResult[] = data.results.slice(0, 5).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content?.substring(0, 500) || "",
      }));

      return results;
    } catch (error) {
      console.error("[SearXNG] Search failed:", error);
      return [];
    }
  }
}
