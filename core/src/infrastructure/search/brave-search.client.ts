import type { SearchClient, SearchResult } from "@/application/ports";

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

interface BraveSearchResponse {
  web?: {
    results: BraveSearchResult[];
  };
}

export interface BraveSearchConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class BraveSearchClient implements SearchClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config?: BraveSearchConfig) {
    this.apiKey = config?.apiKey ?? process.env.BRAVE_SEARCH_API_KEY ?? "";
    this.baseUrl = config?.baseUrl ?? "https://api.search.brave.com/res/v1/web/search";

    if (!this.apiKey) {
      console.warn("[BraveSearch] No API key provided - search will be disabled");
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    console.log(`[BraveSearch] Query: ${query}`);

    if (!this.apiKey) {
      console.warn("[BraveSearch] Search disabled - no API key");
      return [];
    }

    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set("q", query);
      url.searchParams.set("count", "5");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": this.apiKey,
        },
      });

      if (!response.ok) {
        console.error(`[BraveSearch] HTTP Error: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as BraveSearchResponse;

      if (!data.web?.results) {
        console.log("[BraveSearch] No results");
        return [];
      }

      const results: SearchResult[] = data.web.results.slice(0, 3).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.description?.substring(0, 500) || "",
      }));

      console.log(`[BraveSearch] Found ${results.length} results`);
      return results;
    } catch (error) {
      console.error("[BraveSearch] Search failed:", error);
      return [];
    }
  }
}
