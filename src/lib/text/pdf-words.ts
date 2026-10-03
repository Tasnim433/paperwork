import type { PageWord } from "./types";

/** A text run from a PDF text layer, already in page coordinates with a top-left origin. */
export type TextRun = {
  text: string;
  /** Left edge of the run. */
  x: number;
  /** Top edge of the run. */
  y: number;
  width: number;
  height: number;
};

/**
 * Splits a PDF text run into words. PDFs only position whole runs, so each
 * word's horizontal position is estimated from its share of the characters.
 * Coordinates are returned relative to the page size (0 to 1).
 */
export function splitRunIntoWords(run: TextRun, pageWidth: number, pageHeight: number): PageWord[] {
  const chars = Array.from(run.text);
  if (chars.length === 0 || run.width <= 0) return [];
  const charWidth = run.width / chars.length;
  const words: PageWord[] = [];

  let start = -1;
  const push = (end: number) => {
    const text = chars.slice(start, end).join("");
    words.push({
      text,
      x: (run.x + start * charWidth) / pageWidth,
      y: run.y / pageHeight,
      width: ((end - start) * charWidth) / pageWidth,
      height: run.height / pageHeight,
    });
  };

  chars.forEach((char, i) => {
    const space = /\s/.test(char);
    if (!space && start < 0) start = i;
    if (space && start >= 0) {
      push(i);
      start = -1;
    }
  });
  if (start >= 0) push(chars.length);
  return words;
}

/** Plain text of a page, words joined by spaces, lines by newlines (based on vertical position). */
export function pageTextFromWords(words: PageWord[]): string {
  let text = "";
  let lastY: number | null = null;
  for (const word of words) {
    if (lastY !== null) text += Math.abs(word.y - lastY) > word.height * 0.5 ? "\n" : " ";
    text += word.text;
    lastY = word.y;
  }
  return text;
}
