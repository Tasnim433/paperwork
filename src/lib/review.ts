/**
 * Pure logic of the Review screen, shared by the browser (live validation and
 * preview) and the server actions (which re-check everything before saving).
 */
import type { Locale } from "@/i18n/config";

import { addDays, type IsoDate } from "./dates";
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
        edited || !original
          ? { value: current.trim() || null, confidence: null, located: true }
          : { value: original.value, confidence: original.confidence, located: original.located },
      ];
    }),
  );
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

/** What confirming creates, derived by fixed rules from the type and the validated fields. */
export type PlannedAction =
  | {
      kind: "task";
      taskKind: "pay" | "attend" | "prepare" | "respond";
      /** Message key under review.creates.titles. */
      title: "pay" | "attend" | "prepare" | "respond" | "handle";
      values: Record<string, string>;
      dueDate: IsoDate | null;
      amountCents: number | null;
      /** Reminder dates (only for the main task with a deadline). */
      reminders: IsoDate[];
    }
  | { kind: "workDays"; month: string; fullDays: number; halfDays: number; hours: string | null }
  | { kind: "record" };

/**
 * Plans tasks, reminders and work-day entries. `values` are the normalized
 * results of validation (ISO dates, decimal amounts, HH:MM, YYYY-MM).
 * Reminders are scheduled at the user's offsets before the deadline, never in the past.
 */
export function plannedActions(
  type: DocumentTypeKey,
  results: Pick<FieldResult, "key" | "value">[],
  options: { reminderOffsetDays: number[]; today: IsoDate },
): PlannedAction[] {
  const get = (key: string) => results.find((result) => result.key === key)?.value ?? null;
  const sender = get("sender") ?? "";
  const reminders = (due: IsoDate | null) =>
    due
      ? [...new Set(options.reminderOffsetDays)]
          .sort((a, b) => b - a)
          .map((offset) => addDays(due, -offset))
          .filter((date) => date > options.today)
      : [];

  const actions: PlannedAction[] = [];

  switch (type) {
    case "invoice": {
      const due = get("due_date");
      const amount = get("amount");
      actions.push({
        kind: "task",
        taskKind: "pay",
        title: "pay",
        values: { amount: amount ?? "", sender },
        dueDate: due,
        amountCents: amount ? parseAmountCents(amount) : null,
        reminders: reminders(due),
      });
      break;
    }
    case "appointment": {
      const date = get("appointment_date");
      actions.push({
        kind: "task",
        taskKind: "attend",
        title: "attend",
        values: { location: get("location") ?? "", time: get("time") ?? "" },
        dueDate: date,
        amountCents: null,
        reminders: reminders(date),
      });
      const bring = get("bring");
      if (bring) {
        actions.push({
          kind: "task",
          taskKind: "prepare",
          title: "prepare",
          values: { items: bring },
          dueDate: date ? addDays(date, -1) : null,
          amountCents: null,
          reminders: [],
        });
      }
      break;
    }
    case "decision_letter": {
      const deadline = get("response_deadline");
      if (deadline) {
        actions.push({
          kind: "task",
          taskKind: "respond",
          title: "respond",
          values: { sender },
          dueDate: deadline,
          amountCents: null,
          reminders: reminders(deadline),
        });
      }
      break;
    }
    case "other": {
      const deadline = get("deadline");
      if (deadline) {
        actions.push({
          kind: "task",
          taskKind: "respond",
          title: "handle",
          values: { sender },
          dueDate: deadline,
          amountCents: null,
          reminders: reminders(deadline),
        });
      }
      break;
    }
    case "payslip": {
      const month = get("period");
      if (month) {
        actions.push({
          kind: "workDays",
          month,
          fullDays: Number(get("full_days") ?? 0),
          halfDays: Number(get("half_days") ?? 0),
          hours: get("total_hours"),
        });
      }
      break;
    }
    case "contract":
    case "information_only":
      break;
  }

  actions.push({ kind: "record" });
  return actions;
}

/** Validates the form state of the Review screen with the pipeline's rules. */
export function validateReview(
  type: DocumentTypeKey,
  stored: StoredField[],
  values: Record<string, string>,
  locale: Locale,
): FieldResult[] {
  return validateDocument(type, reviewInputs(type, stored, values, locale));
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
