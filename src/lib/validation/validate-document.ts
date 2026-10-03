import {
  deadlineFields,
  documentFields,
  type DocumentTypeKey,
  type FieldDefinition,
} from "@/lib/schemas/document-fields";

import {
  centsToDecimal,
  parseAmountCents,
  parseDate,
  parseIban,
  parseInteger,
  parseMonth,
  parseNumber,
  parseTime,
} from "./parse";
import { checkReference } from "./references";

export type FieldState = "valid" | "check" | "missing";

export type FieldInput = {
  /** Value as returned by the model, or null when not found. */
  value: string | null;
  confidence: number | null;
  /** Whether the source text was found in the recognized words. */
  located: boolean;
};

export type FieldResult = {
  key: string;
  /** Normalized value (ISO date, decimal amount, …), or the raw value if it could not be parsed. */
  value: string | null;
  state: FieldState;
  /** Rule that caused "check" or "missing"; null when valid. */
  rule: string | null;
};

/** Below this confidence a value is flagged for checking even if it parses. */
export const MIN_CONFIDENCE = 0.5;

/** Validates one value by its kind. Returns the normalized value or the rule it broke. */
export function validateValue(
  definition: FieldDefinition,
  raw: string,
  context: { sender?: string | null },
): { value: string; rule: string | null } {
  const value = raw.trim();
  switch (definition.kind) {
    case "date": {
      const parsed = parseDate(value);
      return parsed ? { value: parsed, rule: null } : { value, rule: "date.invalid" };
    }
    case "time": {
      const parsed = parseTime(value);
      return parsed ? { value: parsed, rule: null } : { value, rule: "time.invalid" };
    }
    case "month": {
      const parsed = parseMonth(value);
      return parsed ? { value: parsed, rule: null } : { value, rule: "month.invalid" };
    }
    case "amount": {
      const cents = parseAmountCents(value);
      if (cents === null) return { value, rule: "amount.invalid" };
      if (cents < 0) return { value: centsToDecimal(cents), rule: "amount.negative" };
      return { value: centsToDecimal(cents), rule: null };
    }
    case "iban": {
      const parsed = parseIban(value);
      return parsed ? { value: parsed, rule: null } : { value, rule: "iban.invalid" };
    }
    case "reference": {
      const { normalized, rule } = checkReference(value, { ...context, fieldKey: definition.key });
      return { value: normalized, rule };
    }
    case "integer": {
      const parsed = parseInteger(value);
      return parsed === null
        ? { value, rule: "integer.invalid" }
        : { value: String(parsed), rule: null };
    }
    case "number": {
      const parsed = parseNumber(value);
      return parsed === null
        ? { value, rule: "number.invalid" }
        : { value: String(parsed), rule: null };
    }
    case "text":
      return value.length > 0 ? { value, rule: null } : { value, rule: "text.empty" };
  }
}

/**
 * Applies all rules to the extracted fields of one document:
 * required fields, value formats, confidence, source location and deadlines.
 */
export function validateDocument(
  type: DocumentTypeKey,
  inputs: Record<string, FieldInput | undefined>,
): FieldResult[] {
  const definitions = documentFields[type];
  const sender = inputs.sender?.value ?? null;

  const results = definitions.map((definition): FieldResult => {
    const input = inputs[definition.key];
    const raw = input?.value?.trim() ? input.value : null;

    if (raw === null) {
      return definition.required
        ? { key: definition.key, value: null, state: "missing", rule: "required" }
        : { key: definition.key, value: null, state: "valid", rule: null };
    }

    const { value, rule } = validateValue(definition, raw, { sender });
    if (rule) return { key: definition.key, value, state: "check", rule };
    if (!input!.located)
      return { key: definition.key, value, state: "check", rule: "source.notFound" };
    if (input!.confidence !== null && input!.confidence < MIN_CONFIDENCE) {
      return { key: definition.key, value, state: "check", rule: "confidence.low" };
    }
    return { key: definition.key, value, state: "valid", rule: null };
  });

  // Cross-field rule: deadlines must lie after the letter date.
  const letterDate = results.find((r) => r.key === "letter_date");
  if (letterDate?.state === "valid" && letterDate.value) {
    for (const result of results) {
      if (
        deadlineFields.includes(result.key) &&
        result.state === "valid" &&
        result.value &&
        result.value < letterDate.value
      ) {
        result.state = "check";
        result.rule = "date.beforeLetterDate";
      }
    }
  }

  return results;
}

/** Number of fields that need the user's attention. */
export function flaggedCount(results: Pick<FieldResult, "state">[]): number {
  return results.filter((result) => result.state !== "valid").length;
}
