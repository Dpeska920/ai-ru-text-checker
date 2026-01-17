import type { SearchClient, SearchResult } from "@/application/ports";

export interface UnifiedSearchConfig {
  providers: SearchClient[];
}

export class UnifiedSearchClient implements SearchClient {
  private readonly providers: SearchClient[];

  constructor(config: UnifiedSearchConfig) {
    this.providers = config.providers;
    if (this.providers.length === 0) {
      console.warn("[UnifiedSearch] No providers configured - search will be disabled");
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    console.log(`[UnifiedSearch] Query: "${query}" with ${this.providers.length} providers`);

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      const providerName = provider.constructor.name;

      try {
        console.log(`[UnifiedSearch] Trying provider ${i + 1}/${this.providers.length}: ${providerName}`);
        const results = await provider.search(query);

        if (results.length > 0) {
          console.log(`[UnifiedSearch] ${providerName} returned ${results.length} results`);
          return results;
        }

        console.log(`[UnifiedSearch] ${providerName} returned no results, trying next provider`);
      } catch (error) {
        console.error(`[UnifiedSearch] ${providerName} failed: ${error}`);
      }
    }

    console.log("[UnifiedSearch] All providers failed or returned no results");
    return [];
  }
}
