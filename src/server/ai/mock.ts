/**
 * AI_PROVIDER=mock: deterministic results without any API call. Known fixture
 * letters (fixtures/letters) get their expected results; anything else is
 * classified as "other" with no extracted values.
 */
import { documentFields, type DocumentTypeKey } from "@/lib/schemas/document-fields";
import { normalizeForMatch } from "@/lib/text/locate";

import { mockLetters, type MockLetter } from "./mock-letters";

type Classification = { type: DocumentTypeKey; confidence: number };
type ExtractedValue = { value: string | null; sourceText: string | null; confidence: number };

/** The fixture letter a document text belongs to, if any. */
export function findMockLetter(text: string): MockLetter | undefined {
  const normalized = normalizeForMatch(text);
  return mockLetters.find((letter) => letter.markers.some((marker) => normalized.includes(marker)));
}

export function classify(text: string): Classification {
  const letter = findMockLetter(text);
  return letter ? { type: letter.type, confidence: 0.99 } : { type: "other", confidence: 0.2 };
}

export function extract(type: DocumentTypeKey, text: string): Record<string, ExtractedValue> {
  const letter = findMockLetter(text);
  const known = letter?.type === type ? letter.fields : {};
  return Object.fromEntries(
    documentFields[type].map((field) => {
      const mock = known[field.key];
      return [
        field.key,
        mock
          ? {
              value: mock.value,
              sourceText: mock.sourceText ?? mock.value,
              confidence: mock.confidence ?? 0.95,
            }
          : { value: null, sourceText: null, confidence: 0 },
      ];
    }),
  );
}

const typeNames: Record<"de" | "en", Record<DocumentTypeKey, string>> = {
  de: {
    invoice: "Rechnung",
    appointment: "Terminschreiben",
    decision_letter: "Bescheid",
    contract: "Vertrag",
    payslip: "Lohnabrechnung",
    information_only: "Informationsschreiben",
    other: "Schreiben",
  },
  en: {
    invoice: "invoice",
    appointment: "appointment letter",
    decision_letter: "decision letter",
    contract: "contract",
    payslip: "payslip",
    information_only: "information letter",
    other: "letter",
  },
};

/** A short template summary built from the extracted fields. */
export function summarize(input: {
  type: DocumentTypeKey;
  locale: "de" | "en";
  fields: { key: string; value: string | null }[];
}): string {
  const field = (key: string) => input.fields.find((f) => f.key === key)?.value ?? null;
  const name = typeNames[input.locale][input.type];
  const sender = field("sender");
  const amount = field("amount");
  const due = field("due_date") ?? field("appointment_date");

  if (input.locale === "de") {
    let text = `Testzusammenfassung: ${name}${sender ? ` von ${sender}` : ""}.`;
    if (amount) text += ` Betrag: ${amount} €.`;
    if (due) text += ` Frist bzw. Termin: ${due}.`;
    return text;
  }
  let text = `Test summary: ${name}${sender ? ` from ${sender}` : ""}.`;
  if (amount) text += ` Amount: €${amount}.`;
  if (due) text += ` Deadline or date: ${due}.`;
  return text;
}
