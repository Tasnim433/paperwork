/**
 * Pure logic of the Review screen, shared by the browser (live validation and
 * preview) and the server actions (which re-check everything before saving).
 */
import type { Locale } from "@/i18n/config";

import { formatDate } from "./format";
import { documentFields, type DocumentTypeKey, type FieldKind } from "./schemas/document-fields";
import { centsToDecimal, parseAmountCents } from "./validation/parse";
import {
  validateDocument,
  type FieldInput,
  type FieldResult,
} from "./validation/validate-document";

/** A field as stored after the pipeline (or a previous draft). */
export type StoredField = {
  key: string;
  /** Normalized value when valid, otherwise the value as read. */
  value: string | null;
  confidence: number | null;
  /** Whether the value was found in the recognized words. */
  located: boolean;
};

/** How a stored value is shown in the input: dates and amounts in the user's format. */
export function displayValue(kind: FieldKind, value: string | null, locale: Locale): string {
  if (!value) return "";
  if (kind === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value, locale);
  if (kind === "amount") {
    const cents = parseAmountCents(value);
    if (cents !== null && /^-?\d+\.\d{2}$/.test(value)) {
      const decimal = centsToDecimal(cents);
      return locale === "de" ? decimal.replace(".", ",") : decimal;
    }
  }
  return value;
}

/**
 * Validator inputs for the current form state. A value the user changed is taken
 * as confirmed by them: it no longer needs to be found in the document and has
 * no model confidence. Unchanged values keep the pipeline's location and confidence.
 */
export function reviewInputs(
  type: DocumentTypeKey,
  stored: StoredField[],
  values: Record<string, string>,
  locale: Locale,
  accepted: string[] = [],
): Record<string, FieldInput> {
  const byKey = new Map(stored.map((field) => [field.key, field]));
  return Object.fromEntries(
    documentFields[type].map((definition) => {
      const original = byKey.get(definition.key);
      const initial = displayValue(definition.kind, original?.value ?? null, locale);
      const current = values[definition.key] ?? initial;
      const edited = current.trim() !== initial.trim();
      return [
        definition.key,
        edited || !original || accepted.includes(definition.key)
          ? { value: current.trim() || null, confidence: null, located: true }
          : { value: original.value, confidence: original.confidence, located: original.located },
      ];
    }),
  );
}

/**
 * Rules that only say "compare with the original": the user may accept the value
 * as it is. Format errors (invalid IBAN, date, …) always need a corrected value.
 */
export const ACCEPTABLE_RULES = ["source.notFound", "confidence.low"];

export function canAccept(rule: string | null | undefined): boolean {
  return !!rule && ACCEPTABLE_RULES.includes(rule);
}

/** Keys whose value differs from what is stored (after trimming). */
export function editedKeys(
  type: DocumentTypeKey,
  stored: StoredField[],
  values: Record<string, string>,
  locale: Locale,
): string[] {
  const byKey = new Map(stored.map((field) => [field.key, field]));
  return documentFields[type]
    .filter((definition) => {
      const initial = displayValue(
        definition.kind,
        byKey.get(definition.key)?.value ?? null,
        locale,
      );
      const current = values[definition.key];
      return current !== undefined && current.trim() !== initial.trim();
    })
    .map((definition) => definition.key);
}

export type CheckKey = "required" | "formats" | "found" | "deadline" | "duplicate";

const formatRule = /\.(invalid|negative|format|healthInsurance|broadcastingFee|empty)$/;

/** The deterministic checks shown in section 3. All must pass before confirming. */
export function documentChecks(
  results: Pick<FieldResult, "state" | "rule">[],
  duplicate: boolean,
): { key: CheckKey; passed: boolean }[] {
  const rules = results.map((result) => result.rule ?? "");
  return [
    { key: "required", passed: !rules.includes("required") },
    { key: "formats", passed: !rules.some((rule) => formatRule.test(rule)) },
    {
      key: "found",
      passed: !rules.some((rule) => rule === "source.notFound" || rule === "confidence.low"),
    },
    { key: "deadline", passed: !rules.includes("date.beforeLetterDate") },
    { key: "duplicate", passed: !duplicate },
  ];
}

export function canConfirm(results: Pick<FieldResult, "state">[], duplicate: boolean): boolean {
  return !duplicate && results.every((result) => result.state === "valid");
}

/** Validates the form state of the Review screen with the pipeline's rules. */
export function validateReview(
  type: DocumentTypeKey,
  stored: StoredField[],
  values: Record<string, string>,
  locale: Locale,
  accepted: string[] = [],
): FieldResult[] {
  return validateDocument(type, reviewInputs(type, stored, values, locale, accepted));
}

/** Fields that identify the same letter arriving twice (in addition to type and sender). */
const identityKeys: Record<DocumentTypeKey, string[]> = {
  invoice: ["amount", "due_date", "reference"],
  appointment: ["appointment_date", "time"],
  decision_letter: ["letter_date", "case_number"],
  contract: ["reference", "start_date"],
  payslip: ["period"],
  information_only: ["letter_date", "subject"],
  other: ["letter_date", "subject"],
};

type IdentityDoc = { type: DocumentTypeKey | null; values: Record<string, string | null> };

/**
 * Whether two documents are the same letter (e.g. scanned twice): same type and
 * sender, and every identifying value equal, with at least one of them present.
 */
export function isSameLetter(a: IdentityDoc, b: IdentityDoc): boolean {
  if (!a.type || a.type !== b.type) return false;
  const norm = (value: string | null | undefined) => value?.trim().toLowerCase() || null;
  if (!norm(a.values.sender) || norm(a.values.sender) !== norm(b.values.sender)) return false;
  const keys = identityKeys[a.type];
  const present = keys.filter((key) => norm(a.values[key]) !== null);
  return present.length > 0 && keys.every((key) => norm(a.values[key]) === norm(b.values[key]));
}

/** The document to open after `currentId` leaves the review queue: the next one, else the previous. */
export function nextInQueue(queue: string[], currentId: string): string | null {
  const index = queue.indexOf(currentId);
  const rest = queue.filter((id) => id !== currentId);
  if (rest.length === 0) return null;
  if (index < 0) return rest[0];
  return rest[Math.min(index, rest.length - 1)];
}
