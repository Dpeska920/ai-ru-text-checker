export interface SpellCheckMatch {
  message: string;
  offset: number;
  length: number;
  replacements: string[];
  ruleId: string;
  ruleDescription: string;
}

export interface SpellCheckResult {
  matches: SpellCheckMatch[];
  correctedText: string;
}

export interface SpellCheckClient {
  check(text: string, language?: string): Promise<SpellCheckResult>;
}
