import type { SpellCheckClient, SpellCheckMatch, SpellCheckResult } from "@/application/ports";
import nspell from "nspell";
import dictionaryRu from "dictionary-ru";

interface YandexSpellerError {
  code: number;
  pos: number;
  row: number;
  col: number;
  len: number;
  word: string;
  s: string[];
}

interface UnknownWord {
  word: string;
  offset: number;
  length: number;
}

const YANDEX_SPELLER_URL = "https://speller.yandex.net/services/spellservice.json";
const IGNORE_DIGITS = 2;
const IGNORE_URLS = 4;
const FIND_REPEAT_WORDS = 8;

export class HunspellYandexClient implements SpellCheckClient {
  private spell: ReturnType<typeof nspell> | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly yandexOptions: number;

  constructor() {
    this.yandexOptions = IGNORE_DIGITS | IGNORE_URLS | FIND_REPEAT_WORDS;
  }

  private async init(): Promise<void> {
    if (this.spell) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // dictionary-ru exports { aff, dic } directly
        this.spell = nspell(dictionaryRu);
        console.log("[Hunspell] Russian dictionary loaded");
      } catch (err) {
        console.error("[Hunspell] Failed to load dictionary:", err);
        throw err;
      }
    })();

    return this.initPromise;
  }

  async check(text: string, language = "ru"): Promise<SpellCheckResult> {
    console.log(`[SpellCheck] Checking text, length: ${text.length}`);

    await this.init();

    if (!this.spell) {
      console.warn("[SpellCheck] Hunspell not initialized, falling back to Yandex only");
      return this.yandexFullCheck(text);
    }

    // Step 1: Find unknown words via Hunspell (fast, local)
    const unknownWords = this.findUnknownWords(text);
    console.log(`[SpellCheck] Hunspell found ${unknownWords.length} unknown words`);

    if (unknownWords.length === 0) {
      return { matches: [], correctedText: text };
    }

    // Step 2: Get corrections from Yandex Speller for unknown words only
    const matches = await this.getYandexCorrections(unknownWords);
    console.log(`[SpellCheck] Yandex provided ${matches.length} corrections`);

    // Step 3: Apply corrections
    const correctedText = this.applyCorrections(text, matches);

    return { matches, correctedText };
  }

  private findUnknownWords(text: string): UnknownWord[] {
    if (!this.spell) return [];

    const unknownWords: UnknownWord[] = [];
    const wordRegex = /[а-яёА-ЯЁ]+/g;
    let match: RegExpExecArray | null;

    while ((match = wordRegex.exec(text)) !== null) {
      const word = match[0];
      const offset = match.index;

      // Skip short words (1-2 letters)
      if (word.length <= 2) continue;

      // Check if word is in dictionary
      if (!this.spell.correct(word) && !this.spell.correct(word.toLowerCase())) {
        unknownWords.push({
          word,
          offset,
          length: word.length,
        });
        console.log(`[Hunspell] Unknown word: "${word}"`);
      }
    }

    return unknownWords;
  }

  private async getYandexCorrections(unknownWords: UnknownWord[]): Promise<SpellCheckMatch[]> {
    const matches: SpellCheckMatch[] = [];

    // Process in batches to avoid too many requests
    const batchSize = 10;
    for (let i = 0; i < unknownWords.length; i += batchSize) {
      const batch = unknownWords.slice(i, i + batchSize);
      const wordsText = batch.map(w => w.word).join(" ");

      try {
        const response = await fetch(`${YANDEX_SPELLER_URL}/checkText`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            text: wordsText,
            lang: "ru",
            options: this.yandexOptions.toString(),
          }),
        });

        if (!response.ok) {
          console.error(`[Yandex] HTTP Error: ${response.status}`);
          continue;
        }

        const data = (await response.json()) as YandexSpellerError[];

        // Map Yandex results back to original positions
        for (const error of data) {
          const unknownWord = batch.find(w => w.word.toLowerCase() === error.word.toLowerCase());
          if (unknownWord && error.s.length > 0) {
            matches.push({
              message: "Слово не найдено в словаре",
              offset: unknownWord.offset,
              length: unknownWord.length,
              replacements: error.s,
              ruleId: "HUNSPELL_YANDEX",
              ruleDescription: "Unknown word with Yandex suggestion",
            });
            console.log(`[Yandex] Correction: "${error.word}" → [${error.s.slice(0, 3).join(", ")}]`);
          }
        }
      } catch (error) {
        console.error(`[Yandex] Batch error:`, error);
      }
    }

    return matches;
  }

  private async yandexFullCheck(text: string): Promise<SpellCheckResult> {
    try {
      const response = await fetch(`${YANDEX_SPELLER_URL}/checkText`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          text,
          lang: "ru",
          options: this.yandexOptions.toString(),
        }),
      });

      if (!response.ok) {
        return { matches: [], correctedText: text };
      }

      const data = (await response.json()) as YandexSpellerError[];
      const matches: SpellCheckMatch[] = data.map((error) => ({
        message: "Слово не найдено в словаре",
        offset: error.pos,
        length: error.len,
        replacements: error.s,
        ruleId: "YANDEX",
        ruleDescription: "Yandex Speller",
      }));

      const correctedText = this.applyCorrections(text, matches);
      return { matches, correctedText };
    } catch {
      return { matches: [], correctedText: text };
    }
  }

  private applyCorrections(text: string, matches: SpellCheckMatch[]): string {
    if (matches.length === 0) return text;

    const sorted = [...matches].sort((a, b) => b.offset - a.offset);
    let result = text;

    for (const match of sorted) {
      if (match.replacements.length > 0) {
        const before = result.slice(0, match.offset);
        const after = result.slice(match.offset + match.length);
        const original = result.slice(match.offset, match.offset + match.length);
        result = before + match.replacements[0] + after;
        console.log(`[SpellCheck] Fixed: "${original}" → "${match.replacements[0]}"`);
      }
    }

    return result;
  }
}
