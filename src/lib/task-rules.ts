/**
 * Deterministic rules that turn a confirmed document into tasks, reminders and
 * work-day entries. The Review preview and the confirm action both call
 * `tasksForDocument`, so what the preview shows is exactly what gets created.
 *
 *   invoice          -> pay (amount, due date), unless paid by direct debit
 *   appointment      -> attend (on the date) + prepare (the day before)
 *   decision_letter  -> respond, if a response deadline exists
 *   other            -> respond, if a deadline exists
 *   payslip          -> work-day entry, no task
 *   contract         -> nothing
 *   information_only -> nothing
 */
import { addDays, type IsoDate } from "./dates";
import type { DocumentTypeKey } from "./schemas/document-fields";
import { parseAmountCents } from "./validation/parse";

/** Longest note a user can add when marking a task done. */
export const MAX_TASK_NOTE_LENGTH = 500;

export type PlannedTask = {
  kind: "task";
  taskKind: "pay" | "attend" | "prepare" | "respond";
  /** Message key under review.creates.titles. */
  title: "pay" | "attend" | "prepare" | "prepareGeneric" | "respond" | "handle";
  values: Record<string, string>;
  dueDate: IsoDate | null;
  amountCents: number | null;
  /** Reminder dates (only for tasks with a deadline the user must meet). */
  reminders: IsoDate[];
};

export type PlannedAction =
  | PlannedTask
  | { kind: "workDays"; month: string; fullDays: number; halfDays: number; hours: string | null }
  /** Shown instead of a task, e.g. "no payment task: paid by direct debit". */
  | { kind: "note"; reason: "directDebit" }
  | { kind: "record" };

export type RuleOptions = {
  /** Days before a deadline when reminders are sent (user setting). */
  reminderOffsetDays: number[];
  today: IsoDate;
  /** Whether the recognized letter text says the amount is collected by direct debit. */
  textMentionsDirectDebit?: boolean;
};

// Unambiguous wordings only: "Einzug" alone also means moving in, "ziehen wir" can be "ziehen wir um".
const DIRECT_DEBIT =
  /lastschrift|abbuchung|abgebucht|bankeinzug|einzugsermächtigung|wird (von ihrem konto )?eingezogen|sepa-?mandat|mandatsreferenz|direct debit|debited from/i;
const TRANSFER = /überweis|ueberweis|bank transfer|please transfer|transfer the amount/i;

/** How an invoice is paid, from the extracted payment method (as written in the letter). */
export function parsePaymentMethod(
  value: string | null | undefined,
): "direct_debit" | "transfer" | null {
  if (!value?.trim()) return null;
  if (DIRECT_DEBIT.test(value)) return "direct_debit";
  if (TRANSFER.test(value)) return "transfer";
  return null;
}

/** Whether the letter text says the amount will be collected by direct debit. */
export function textMentionsDirectDebit(text: string): boolean {
  return DIRECT_DEBIT.test(text);
}

/**
 * Direct debit when the payment method says so, or when the text says so and the
 * payment method does not explicitly say bank transfer.
 */
export function isDirectDebit(paymentMethod: string | null | undefined, textFlag = false): boolean {
  const method = parsePaymentMethod(paymentMethod);
  return method === "direct_debit" || (method !== "transfer" && textFlag);
}

/** Reminder dates before a deadline, latest offset first, never today or in the past. */
export function reminderDates(due: IsoDate | null, offsets: number[], today: IsoDate): IsoDate[] {
  if (!due) return [];
  return [...new Set(offsets)]
    .filter((offset) => offset > 0)
    .sort((a, b) => b - a)
    .map((offset) => addDays(due, -offset))
    .filter((date) => date > today);
}

/**
 * Plans what confirming a document creates. `fields` are the validated values
 * (ISO dates, decimal amounts, HH:MM, YYYY-MM), as produced by validateDocument.
 */
export function tasksForDocument(
  type: DocumentTypeKey,
  fields: { key: string; value: string | null }[],
  options: RuleOptions,
): PlannedAction[] {
  const get = (key: string) => fields.find((field) => field.key === key)?.value ?? null;
  const sender = get("sender") ?? "";
  const reminders = (due: IsoDate | null) =>
    reminderDates(due, options.reminderOffsetDays, options.today);
  const actions: PlannedAction[] = [];

  switch (type) {
    case "invoice": {
      if (isDirectDebit(get("payment_method"), options.textMentionsDirectDebit)) {
        actions.push({ kind: "note", reason: "directDebit" });
        break;
      }
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
      const bring = get("bring");
      actions.push(
        {
          kind: "task",
          taskKind: "attend",
          title: "attend",
          values: { location: get("location") ?? "", time: get("time") ?? "" },
          dueDate: date,
          amountCents: null,
          reminders: reminders(date),
        },
        {
          kind: "task",
          taskKind: "prepare",
          title: bring ? "prepare" : "prepareGeneric",
          values: { items: bring ?? "" },
          dueDate: date ? addDays(date, -1) : null,
          amountCents: null,
          reminders: [],
        },
      );
      break;
    }
    case "decision_letter":
    case "other": {
      const deadline = get(type === "decision_letter" ? "response_deadline" : "deadline");
      if (deadline) {
        actions.push({
          kind: "task",
          taskKind: "respond",
          title: type === "decision_letter" ? "respond" : "handle",
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
