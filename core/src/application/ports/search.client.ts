export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchClient {
  search(query: string): Promise<SearchResult[]>;
}
