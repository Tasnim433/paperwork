import { describe, expect, it } from "vitest";

import { locateSourceText, maxEdits, normalizeForMatch } from "./locate";
import type { PageText } from "./types";

/** Builds a page from lines of text; each word gets a simple position on its line. */
function page(pageNumber: number, lines: string[]): PageText {
  const words = lines.flatMap((line, row) =>
    line
      .split(" ")
      .map((text, col) => ({ text, x: col * 0.1, y: row * 0.05, width: 0.08, height: 0.02 })),
  );
  return { pageNumber, width: 595, height: 842, source: "text_layer", words };
}

const invoice = page(1, [
  "Musterkasse Krankenversicherung · Musterstraße 1 · 94032 Passau",
  "Versichertennummer: X1234S6789",
  "Gesamtbetrag 132,48 €",
  "Bitte überweisen Sie bis zum 15.11.2026 unter Angabe Ihrer Versicherten-",
  "nummer.",
]);

describe("normalizeForMatch", () => {
  it("keeps only lowercase letters and digits", () => {
    expect(normalizeForMatch("132,48 €")).toBe("13248");
    expect(normalizeForMatch("Musterstraße 1")).toBe("musterstraße1");
    expect(normalizeForMatch("  Ä-Ö ")).toBe("äö");
  });
});

describe("locateSourceText", () => {
  it("finds an exact match and returns the page and box of its words", () => {
    const result = locateSourceText([invoice], "15.11.2026");
    expect(result).toMatchObject({ page: 1, exact: true });
    const word = invoice.words[result!.wordIndices[0]];
    expect(word.text).toBe("15.11.2026");
    const box = result!.boundingBox;
    expect(box.x).toBeCloseTo(word.x);
    expect(box.y).toBeCloseTo(word.y);
    expect(box.width).toBeCloseTo(word.width);
    expect(box.height).toBeCloseTo(word.height);
  });

  it("ignores spacing, punctuation and currency signs", () => {
    const result = locateSourceText([invoice], "132,48€");
    expect(result?.exact).toBe(true);
    expect(result!.wordIndices.map((i) => invoice.words[i].text)).toEqual(["132,48"]);
  });

  it("spans several words and returns their union box", () => {
    const result = locateSourceText([invoice], "Musterkasse Krankenversicherung");
    expect(result!.wordIndices).toHaveLength(2);
    expect(result!.boundingBox.x).toBe(0);
    expect(result!.boundingBox.width).toBeCloseTo(0.18);
  });

  it("matches words hyphenated across a line break", () => {
    const result = locateSourceText([invoice], "Versichertennummer.");
    // The first exact occurrence is on line 2; the hyphenated one would also match.
    expect(result?.exact).toBe(true);
    const onlyHyphenated = locateSourceText(
      [page(1, ["Ihrer Versicherten-", "nummer."])],
      "Versichertennummer",
    );
    expect(onlyHyphenated?.wordIndices).toEqual([1, 2]);
  });

  it("is case-insensitive", () => {
    expect(locateSourceText([invoice], "GESAMTBETRAG")?.exact).toBe(true);
  });

  it("tolerates small OCR errors in longer text", () => {
    const ocr = page(1, ["Termin am 22.10.2026 um 09:3O Uhr, Zimmer 2.14"]);
    const result = locateSourceText([ocr], "um 09:30 Uhr");
    expect(result).toMatchObject({ exact: false });
    expect(result!.wordIndices.map((i) => ocr.words[i].text)).toEqual(["um", "09:3O", "Uhr,"]);
  });

  it("does not fuzzy-match short values", () => {
    expect(maxEdits(4)).toBe(0);
    expect(locateSourceText([page(1, ["Zimmer 2.15"])], "2.14")).toBeNull();
  });

  it("returns null when the text is not on any page", () => {
    expect(locateSourceText([invoice], "Kündigungsfrist drei Monate")).toBeNull();
    expect(locateSourceText([invoice], "   ")).toBeNull();
  });

  it("searches all pages and reports the right page number", () => {
    const second = page(2, ["Anlage: Zahlungsplan Rate 3"]);
    expect(locateSourceText([invoice, second], "Zahlungsplan")?.page).toBe(2);
  });

  it("prefers matches that start at a word boundary", () => {
    const text = page(1, ["Abc123 123"]);
    expect(locateSourceText([text], "123")?.wordIndices).toEqual([1]);
  });
});
