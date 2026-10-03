import { describe, expect, it } from "vitest";

import { pageTextFromWords, splitRunIntoWords } from "./pdf-words";

describe("splitRunIntoWords", () => {
  it("splits a run on whitespace and positions words by character share", () => {
    const words = splitRunIntoWords(
      { text: "Gesamt 132,48 €", x: 100, y: 200, width: 150, height: 12 },
      1000,
      1000,
    );
    expect(words.map((w) => w.text)).toEqual(["Gesamt", "132,48", "€"]);
    expect(words[0]).toEqual({ text: "Gesamt", x: 0.1, y: 0.2, width: 0.06, height: 0.012 });
    expect(words[1].x).toBeCloseTo(0.17);
    expect(words[2].x).toBeCloseTo(0.24);
  });

  it("ignores leading, trailing and repeated spaces", () => {
    const words = splitRunIntoWords(
      { text: "  a   b ", x: 0, y: 0, width: 80, height: 10 },
      100,
      100,
    );
    expect(words.map((w) => w.text)).toEqual(["a", "b"]);
  });

  it("returns nothing for empty runs", () => {
    expect(splitRunIntoWords({ text: "", x: 0, y: 0, width: 10, height: 10 }, 100, 100)).toEqual(
      [],
    );
    expect(splitRunIntoWords({ text: "x", x: 0, y: 0, width: 0, height: 10 }, 100, 100)).toEqual(
      [],
    );
  });
});

describe("pageTextFromWords", () => {
  it("joins words on a line with spaces and lines with newlines", () => {
    const word = (text: string, y: number) => ({ text, x: 0, y, width: 0.1, height: 0.02 });
    expect(pageTextFromWords([word("Sehr", 0.1), word("geehrte", 0.1), word("Frau", 0.15)])).toBe(
      "Sehr geehrte\nFrau",
    );
  });
});
