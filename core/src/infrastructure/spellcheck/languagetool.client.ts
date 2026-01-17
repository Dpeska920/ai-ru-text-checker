import type { SpellCheckClient, SpellCheckMatch, SpellCheckResult } from "@/application/ports";

interface LanguageToolMatch {
  message: string;
  offset: number;
  length: number;
  replacements: Array<{ value: string }>;
  rule: {
    id: string;
    description: string;
  };
}

interface LanguageToolResponse {
  matches: LanguageToolMatch[];
}

export interface LanguageToolConfig {
  baseUrl: string;
}

export class LanguageToolClient implements SpellCheckClient {
  private readonly baseUrl: string;

  constructor(config?: LanguageToolConfig) {
    this.baseUrl = config?.baseUrl ?? process.env.LANGUAGETOOL_URL ?? "http://localhost:8010/v2";
  }

  async check(text: string, language = "ru"): Promise<SpellCheckResult> {
    console.log(`[LanguageTool] Checking text, length: ${text.length}, language: ${language}`);

    try {
      const response = await fetch(`${this.baseUrl}/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          text,
          language,
          enabledOnly: "false",
        }),
      });

      if (!response.ok) {
        console.error(`[LanguageTool] HTTP Error: ${response.status}`);
        return { matches: [], correctedText: text };
      }

      const data = (await response.json()) as LanguageToolResponse;
      console.log(`[LanguageTool] Found ${data.matches.length} issues`);

      const matches: SpellCheckMatch[] = data.matches.map((m) => ({
        message: m.message,
        offset: m.offset,
        length: m.length,
        replacements: m.replacements.map((r) => r.value),
        ruleId: m.rule.id,
        ruleDescription: m.rule.description,
      }));

      // Apply corrections automatically (first suggestion)
      const correctedText = this.applyCorrections(text, matches);

      return { matches, correctedText };
    } catch (error) {
      console.error(`[LanguageTool] Error: ${error}`);
      return { matches: [], correctedText: text };
    }
  }

  private applyCorrections(text: string, matches: SpellCheckMatch[]): string {
    if (matches.length === 0) {
      return text;
    }

    // Sort by offset descending to apply from end to start (preserves offsets)
    const sorted = [...matches].sort((a, b) => b.offset - a.offset);

    let result = text;
    for (const match of sorted) {
      if (match.replacements.length > 0) {
        const before = result.slice(0, match.offset);
        const after = result.slice(match.offset + match.length);
        result = before + match.replacements[0] + after;
        console.log(`[LanguageTool] Fixed: "${text.slice(match.offset, match.offset + match.length)}" → "${match.replacements[0]}"`);
      }
    }

    return result;
  }
}
