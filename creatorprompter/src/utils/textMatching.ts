export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9']/g, "")
    .trim();
}

export function tokenizeScript(script: string): { original: string; normalized: string; paragraphIndex: number }[] {
  const paragraphs = script.split(/\n+/);
  const tokens: { original: string; normalized: string; paragraphIndex: number }[] = [];

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    for (const word of words) {
      tokens.push({ original: word, normalized: normalizeWord(word), paragraphIndex });
    }
  });

  return tokens;
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 0; i < a.length; i++) {
    const currentRow = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const insertCost = currentRow[j] + 1;
      const deleteCost = previousRow[j + 1] + 1;
      const substituteCost = previousRow[j] + (a[i] === b[j] ? 0 : 1);
      currentRow.push(Math.min(insertCost, deleteCost, substituteCost));
    }
    previousRow = currentRow;
  }

  return previousRow[b.length];
}

export function wordSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}
