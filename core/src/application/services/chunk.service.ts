export interface TextChunk {
  index: number;
  text: string;
  startOffset: number;
}

export class ChunkService {
  private readonly maxSentencesPerChunk: number;

  constructor(maxSentencesPerChunk = 5) {
    this.maxSentencesPerChunk = maxSentencesPerChunk;
  }

  splitIntoChunks(text: string): TextChunk[] {
    const paragraphs = this.splitIntoParagraphs(text);
    const chunks: TextChunk[] = [];
    let currentOffset = 0;

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        currentOffset += paragraph.length + 2; // +2 for \n\n
        continue;
      }

      const sentences = this.splitIntoSentences(paragraph);

      if (sentences.length <= this.maxSentencesPerChunk) {
        chunks.push({
          index: chunks.length,
          text: paragraph,
          startOffset: currentOffset,
        });
      } else {
        // Split large paragraph into smaller chunks
        for (let i = 0; i < sentences.length; i += this.maxSentencesPerChunk) {
          const chunkSentences = sentences.slice(i, i + this.maxSentencesPerChunk);
          const chunkText = chunkSentences.join(" ");

          chunks.push({
            index: chunks.length,
            text: chunkText,
            startOffset: currentOffset,
          });

          currentOffset += chunkText.length + 1;
        }
        continue;
      }

      currentOffset += paragraph.length + 2;
    }

    return chunks;
  }

  reassembleText(chunks: TextChunk[], correctedChunks: Map<number, string>): string {
    return chunks
      .map((chunk) => correctedChunks.get(chunk.index) ?? chunk.text)
      .join("\n\n");
  }

  private splitIntoParagraphs(text: string): string[] {
    return text.split(/\n\n+/);
  }

  private splitIntoSentences(text: string): string[] {
    // Split by sentence-ending punctuation, keeping the punctuation
    const sentences: string[] = [];
    let current = "";

    for (let i = 0; i < text.length; i++) {
      current += text[i];

      // Check for sentence end: . ! ? followed by space or end of text
      if (/[.!?]/.test(text[i])) {
        const nextChar = text[i + 1];
        if (!nextChar || /\s/.test(nextChar)) {
          sentences.push(current.trim());
          current = "";
        }
      }
    }

    if (current.trim()) {
      sentences.push(current.trim());
    }

    return sentences;
  }
}
