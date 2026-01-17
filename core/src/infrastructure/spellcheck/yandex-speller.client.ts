import type { SpellCheckClient, SpellCheckMatch, SpellCheckResult } from "@/application/ports";

interface YandexSpellerError {
  code: number;
  pos: number;
  row: number;
  col: number;
  len: number;
  word: string;
  s: string[];
}

// Yandex Speller options bitmask
const IGNORE_DIGITS = 2;
const IGNORE_URLS = 4;
const FIND_REPEAT_WORDS = 8;
const IGNORE_CAPITALIZATION = 512;

export interface YandexSpellerConfig {
  baseUrl?: string;
  options?: number;
}

export class YandexSpellerClient implements SpellCheckClient {
  private readonly baseUrl: string;
  private readonly options: number;

  constructor(config?: YandexSpellerConfig) {
    this.baseUrl = config?.baseUrl ?? "https://speller.yandex.net/services/spellservice.json";
    this.options = config?.options ?? (IGNORE_DIGITS | IGNORE_URLS | FIND_REPEAT_WORDS);
  }

  async check(text: string, language = "ru"): Promise<SpellCheckResult> {
    console.log(`[YandexSpeller] Checking text, length: ${text.length}, language: ${language}`);

    const paragraphs = this.splitIntoParagraphs(text);
    console.log(`[YandexSpeller] Split into ${paragraphs.length} paragraphs`);

    const allMatches: SpellCheckMatch[] = [];
    let globalOffset = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];

      if (paragraph.trim().length === 0) {
        globalOffset += paragraph.length + 1; // +1 for \n
        continue;
      }

      try {
        const matches = await this.checkParagraph(paragraph, language);

        // Adjust offsets to global position
        for (const match of matches) {
          allMatches.push({
            ...match,
            offset: match.offset + globalOffset,
          });
        }
      } catch (error) {
        console.error(`[YandexSpeller] Paragraph ${i + 1} error: ${error}`);
      }

      globalOffset += paragraph.length + 1; // +1 for \n
    }

    console.log(`[YandexSpeller] Total issues found: ${allMatches.length}`);

    for (const match of allMatches) {
      const original = text.slice(match.offset, match.offset + match.length);
      console.log(`[YandexSpeller] Issue: "${original}" → suggestions: [${match.replacements.join(", ")}]`);
    }

    const correctedText = this.applyCorrections(text, allMatches);

    return { matches: allMatches, correctedText };
  }

  private splitIntoParagraphs(text: string): string[] {
    return text.split("\n");
  }

  private async checkParagraph(text: string, language: string): Promise<SpellCheckMatch[]> {
    const response = await fetch(`${this.baseUrl}/checkText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        text,
        lang: language,
        options: this.options.toString(),
      }),
    });

    if (!response.ok) {
      console.error(`[YandexSpeller] HTTP Error: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as YandexSpellerError[];

    return data.map((error) => ({
      message: this.getErrorMessage(error.code),
      offset: error.pos,
      length: error.len,
      replacements: error.s,
      ruleId: `YANDEX_${error.code}`,
      ruleDescription: this.getErrorDescription(error.code),
    }));
  }

  private getErrorMessage(code: number): string {
    switch (code) {
      case 1:
        return "Слово не найдено в словаре";
      case 2:
        return "Повтор слова";
      case 3:
        return "Ошибка капитализации";
      case 4:
        return "Слишком много ошибок";
      default:
        return "Неизвестная ошибка";
    }
  }

  private getErrorDescription(code: number): string {
    switch (code) {
      case 1:
        return "ERROR_UNKNOWN_WORD";
      case 2:
        return "ERROR_REPEAT_WORD";
      case 3:
        return "ERROR_CAPITALIZATION";
      case 4:
        return "ERROR_TOO_MANY_ERRORS";
      default:
        return "ERROR_UNKNOWN";
    }
  }

  private applyCorrections(text: string, matches: SpellCheckMatch[]): string {
    if (matches.length === 0) {
      return text;
    }

    const sorted = [...matches].sort((a, b) => b.offset - a.offset);

    let result = text;
    for (const match of sorted) {
      if (match.replacements.length > 0) {
        const before = result.slice(0, match.offset);
        const after = result.slice(match.offset + match.length);
        const original = result.slice(match.offset, match.offset + match.length);
        result = before + match.replacements[0] + after;
        console.log(`[YandexSpeller] Fixed: "${original}" → "${match.replacements[0]}"`);
      }
    }

    return result;
  }
}
