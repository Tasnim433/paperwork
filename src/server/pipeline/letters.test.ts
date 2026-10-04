/**
 * Runs every fixture letter (fixtures/letters, see EXPECTED_RESULTS.md) through
 * the pipeline logic without database or API key: real text recognition (PDF
 * text layer and OCR), AI_PROVIDER=mock for classification and extraction,
 * real source location and validation.
 *
 * The first run downloads the OCR language data (~15 MB) into .data/tesseract.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import type { DocumentTypeKey } from "@/lib/schemas/document-fields";
import { locateValue } from "@/lib/text/locate";
import { pageTextFromWords } from "@/lib/text/pdf-words";
import { validateDocument, type FieldResult } from "@/lib/validation/validate-document";

import { classifyDocument, documentPrompt, extractFields, summarizeDocument } from "../ai";
import { extractText, terminateOcr } from "./text-extraction";

const LETTERS = path.join(process.cwd(), "fixtures", "letters");

async function processLetter(file: string) {
  const bytes = new Uint8Array(readFileSync(path.join(LETTERS, file)));
  const pages = await extractText(bytes, file.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  const text = documentPrompt(
    pages.map((page) => ({ pageNumber: page.pageNumber, text: pageTextFromWords(page.words) })),
  );
  const { type } = await classifyDocument(text);
  const values = await extractFields(type, text);
  const inputs = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      {
        value: value.value,
        confidence: value.confidence,
        located: locateValue(pages, value) !== null,
      },
    ]),
  );
  const results = validateDocument(type, inputs);
  const fields = Object.fromEntries(results.map((result) => [result.key, result])) as Record<
    string,
    FieldResult
  >;
  return { type, fields, results, pages };
}

const stateOf = (results: FieldResult[]) =>
  Object.fromEntries(results.map((r) => [r.key, r.rule ? `${r.state} (${r.rule})` : r.state]));

afterAll(async () => {
  await terminateOcr();
});

describe("fixture letters with AI_PROVIDER=mock", { timeout: 180_000 }, () => {
  it("01 health insurance invoice: all fields valid", async () => {
    const { type, fields, results } = await processLetter("01_krankenkasse_beitragsrechnung.pdf");
    expect(type).toBe<DocumentTypeKey>("invoice");
    expect(
      results.every((r) => r.state === "valid"),
      JSON.stringify(stateOf(results)),
    ).toBe(true);
    expect(fields.sender.value).toBe("Musterkasse Krankenversicherung");
    expect(fields.letter_date.value).toBe("2026-09-29");
    expect(fields.amount.value).toBe("132.48");
    expect(fields.due_date.value).toBe("2026-11-15");
    expect(fields.reference.value).toBe("X123456789");
    expect(fields.iban.value).toBe("DE89370400440532013000");
  });

  it("02 fee notice: valid, deadline 15.10.2026", async () => {
    const { type, fields, results } = await processLetter(
      "02_beitragsstelle_zahlungsaufforderung.pdf",
    );
    expect(type).toBe("invoice");
    expect(
      results.every((r) => r.state === "valid"),
      JSON.stringify(stateOf(results)),
    ).toBe(true);
    expect(fields.amount.value).toBe("55.08");
    expect(fields.due_date.value).toBe("2026-10-15");
    expect(fields.reference.value).toBe("482 113 907");
    expect(fields.iban.value).toBe("DE02120300000000202051");
  });

  it("03 appointment photo (OCR): date, time and items found", async () => {
    const { type, fields, results, pages } = await processLetter(
      "03_auslaenderbehoerde_terminbestaetigung.jpg",
    );
    expect(pages[0].source).toBe("ocr");
    expect(type).toBe("appointment");
    expect(
      results.every((r) => r.state === "valid"),
      JSON.stringify(stateOf(results)),
    ).toBe(true);
    expect(fields.appointment_date.value).toBe("2026-10-22");
    expect(fields.time.value).toBe("09:30");
    expect(fields.case_number.value).toBe("AB-2026-04417");
    expect(fields.bring.value).toContain("Nachweis über die Krankenversicherung");
  });

  it("04 payslip: 3 full and 11 half days = 8.5 full-day equivalents", async () => {
    const { type, fields, results } = await processLetter("04_lohnabrechnung_september_2026.pdf");
    expect(type).toBe("payslip");
    expect(
      results.every((r) => r.state === "valid"),
      JSON.stringify(stateOf(results)),
    ).toBe(true);
    expect(fields.period.value).toBe("2026-09");
    expect(fields.total_hours.value).toBe("63.5");
    expect(fields.gross_pay.value).toBe("882.65");
    expect(fields.net_pay.value).toBe("815.04");
    const full = Number(fields.full_days.value);
    const half = Number(fields.half_days.value);
    expect([full, half]).toEqual([3, 11]);
    expect(full + half / 2).toBe(8.5);
  });

  it("05 utility statement: invalid IBAN is flagged, everything else valid", async () => {
    const { type, fields, results } = await processLetter("05_nebenkostenabrechnung_2025.pdf");
    expect(type).toBe("invoice");
    expect(fields.iban).toMatchObject({ state: "check", rule: "iban.invalid" });
    expect(results.filter((r) => r.state !== "valid").map((r) => r.key)).toEqual(["iban"]);
    expect(fields.amount.value).toBe("86.20");
    expect(fields.due_date.value).toBe("2026-10-31");
  });

  it("06 university information: information only", async () => {
    const { type, fields } = await processLetter("06_universitaet_information.pdf");
    expect(type).toBe("information_only");
    expect(fields.sender).toMatchObject({ state: "valid" });
    expect(fields.letter_date.value).toBe("2026-09-15");
  });

  it("07 blurry photo: classified, but unreadable values are flagged for checking", async () => {
    const { type, fields, results } = await processLetter("07_stadtwerke_abschlag_unscharf.jpg");
    expect(type).toBe("invoice");
    expect(fields.sender.state).toBe("valid");
    const flagged = results.filter((r) => r.state !== "valid");
    expect(flagged.length).toBeGreaterThan(0);
    expect(
      flagged.every((r) => r.rule === "source.notFound"),
      JSON.stringify(stateOf(results)),
    ).toBe(true);
  });
});

describe("mock provider", () => {
  it("classifies unknown documents as other with no values", async () => {
    const text = "Sehr geehrte Damen und Herren, dies ist ein unbekanntes Schreiben.";
    expect(await classifyDocument(text)).toEqual({ type: "other", confidence: 0.2 });
    const values = await extractFields("other", text);
    expect(Object.values(values).every((v) => v.value === null)).toBe(true);
  });

  it("writes a deterministic summary in the user's language", async () => {
    const input = {
      type: "invoice" as const,
      text: "",
      fields: [
        { key: "sender", value: "Musterkasse Krankenversicherung" },
        { key: "amount", value: "132.48" },
        { key: "due_date", value: "2026-11-15" },
      ],
    };
    expect(await summarizeDocument({ ...input, locale: "de" })).toBe(
      "Testzusammenfassung: Rechnung von Musterkasse Krankenversicherung. Betrag: 132.48 €. Frist bzw. Termin: 2026-11-15.",
    );
    expect(await summarizeDocument({ ...input, locale: "en" })).toContain(
      "Test summary: invoice from Musterkasse Krankenversicherung.",
    );
  });
});
