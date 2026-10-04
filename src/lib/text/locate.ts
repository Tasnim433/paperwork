import type { BoundingBox, PageText } from "./types";

/**
 * Finds the words on the pages that make up a piece of source text, so a value
 * can be highlighted in the original.
 *
 * Text is compared as a stream of letters and digits only: case, whitespace,
 * punctuation, currency signs and line-break hyphenation are ignored. An exact
 * match wins; otherwise the closest stretch within a small edit distance
 * (OCR errors such as "O" for "0") is accepted.
 */

export type LocateResult = {
  page: number;
  boundingBox: BoundingBox;
  /** Indices of the matched words on that page. */
  wordIndices: number[];
  exact: boolean;
};

/** Lowercase letters and digits only, with umlauts and ß kept, compatibility forms folded. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Maximum edits allowed for a fuzzy match of a given length. */
export function maxEdits(length: number): number {
  if (length < 5) return 0;
  return Math.max(1, Math.floor(length * 0.15));
}

type Stream = {
  text: string;
  /** For each character in `text`, the index of the word it came from. */
  wordOf: number[];
  /** Character offset where each word starts (-1 for words without letters or digits). */
  wordStart: number[];
};

function buildStream(page: PageText): Stream {
  let text = "";
  const wordOf: number[] = [];
  const wordStart: number[] = [];
  page.words.forEach((word, index) => {
    const normalized = normalizeForMatch(word.text);
    wordStart.push(normalized ? text.length : -1);
    text += normalized;
    for (let i = 0; i < normalized.length; i++) wordOf.push(index);
  });
  return { text, wordOf, wordStart };
}

/** Edit distance between `needle` and the best prefix of `haystack` (semi-global alignment). */
function bestPrefixDistance(
  needle: string,
  haystack: string,
): { distance: number; length: number } {
  const n = needle.length;
  let previous = Array.from({ length: n + 1 }, (_, i) => i);
  let best = { distance: n, length: 0 };
  for (let j = 1; j <= haystack.length; j++) {
    const current = [j];
    for (let i = 1; i <= n; i++) {
      const cost = needle[i - 1] === haystack[j - 1] ? 0 : 1;
      current[i] = Math.min(previous[i] + 1, current[i - 1] + 1, previous[i - 1] + cost);
    }
    if (current[n] < best.distance) best = { distance: current[n], length: j };
    previous = current;
  }
  return best;
}

function unionBox(page: PageText, indices: number[]): BoundingBox {
  const words = indices.map((i) => page.words[i]);
  const left = Math.min(...words.map((w) => w.x));
  const top = Math.min(...words.map((w) => w.y));
  const right = Math.max(...words.map((w) => w.x + w.width));
  const bottom = Math.max(...words.map((w) => w.y + w.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function wordsInRange(stream: Stream, start: number, length: number): number[] {
  const indices = new Set<number>();
  for (let i = start; i < start + length && i < stream.wordOf.length; i++)
    indices.add(stream.wordOf[i]);
  return [...indices].sort((a, b) => a - b);
}

export function locateSourceText(pages: PageText[], sourceText: string): LocateResult | null {
  const needle = normalizeForMatch(sourceText);
  if (!needle) return null;

  const streams = pages.map(buildStream);

  // 1. Exact match starting at a word boundary.
  for (const [p, stream] of streams.entries()) {
    for (const start of stream.wordStart) {
      if (start >= 0 && stream.text.startsWith(needle, start)) {
        const wordIndices = wordsInRange(stream, start, needle.length);
        return {
          page: pages[p].pageNumber,
          boundingBox: unionBox(pages[p], wordIndices),
          wordIndices,
          exact: true,
        };
      }
    }
  }

  // 2. Closest fuzzy match starting at a word boundary.
  const allowed = maxEdits(needle.length);
  if (allowed === 0) return null;

  let best: { page: number; start: number; length: number; distance: number } | null = null;
  for (const [p, stream] of streams.entries()) {
    for (const start of stream.wordStart) {
      if (start < 0) continue;
      const window = stream.text.slice(start, start + needle.length + allowed);
      const { distance, length } = bestPrefixDistance(needle, window);
      if (distance <= allowed && (!best || distance < best.distance)) {
        best = { page: p, start, length, distance };
      }
    }
  }
  if (!best) return null;

  const wordIndices = wordsInRange(streams[best.page], best.start, best.length);
  return {
    page: pages[best.page].pageNumber,
    boundingBox: unionBox(pages[best.page], wordIndices),
    wordIndices,
    exact: false,
  };
}

/**
 * Locates an extracted value: by its source text first, then by the value itself
 * (models sometimes return a longer or slightly different source snippet).
 */
export function locateValue(
  pages: PageText[],
  extracted: { value: string | null; sourceText: string | null } | undefined,
): LocateResult | null {
  if (!extracted?.value) return null;
  return (
    (extracted.sourceText ? locateSourceText(pages, extracted.sourceText) : null) ??
    locateSourceText(pages, extracted.value)
  );
}
