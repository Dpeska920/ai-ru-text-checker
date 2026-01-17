import type { SpellCheckClient, SpellCheckMatch, SpellCheckResult } from "@/application/ports";

export class CompositeSpellCheckClient implements SpellCheckClient {
  constructor(private readonly clients: SpellCheckClient[]) {
    if (clients.length === 0) {
      throw new Error("At least one spell check client is required");
    }
  }

  async check(text: string, language = "ru"): Promise<SpellCheckResult> {
    console.log(`[CompositeSpellCheck] Running ${this.clients.length} spell checkers`);

    let currentText = text;
    const allMatches: SpellCheckMatch[] = [];

    for (let i = 0; i < this.clients.length; i++) {
      const client = this.clients[i];
      console.log(`[CompositeSpellCheck] Running checker ${i + 1}/${this.clients.length}`);

      try {
        const result = await client.check(currentText, language);

        allMatches.push(...result.matches);

        if (result.correctedText !== currentText) {
          console.log(`[CompositeSpellCheck] Checker ${i + 1} made corrections`);
          currentText = result.correctedText;
        }
      } catch (error) {
        console.error(`[CompositeSpellCheck] Checker ${i + 1} failed: ${error}`);
      }
    }

    console.log(`[CompositeSpellCheck] Total issues found: ${allMatches.length}`);

    return {
      matches: allMatches,
      correctedText: currentText,
    };
  }
}
