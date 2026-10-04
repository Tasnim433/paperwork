import { describe, expect, it } from "vitest";

import {
  isDirectDebit,
  parsePaymentMethod,
  reminderDates,
  tasksForDocument,
  textMentionsDirectDebit,
  type PlannedAction,
} from "./task-rules";

const options = { reminderOffsetDays: [7, 3, 1], today: "2026-10-04" };
const fields = (values: Record<string, string | null>) =>
  Object.entries(values).map(([key, value]) => ({ key, value }));
const summary = (actions: PlannedAction[]) =>
  actions.map((a) =>
    a.kind === "task"
      ? `${a.taskKind}:${a.dueDate}`
      : a.kind === "note"
        ? `note:${a.reason}`
        : a.kind,
  );

describe("invoice", () => {
  const invoice = fields({ sender: "Musterkasse", amount: "132.48", due_date: "2026-11-15" });

  it("creates a pay task with amount, due date and reminders", () => {
    expect(tasksForDocument("invoice", invoice, options)[0]).toEqual({
      kind: "task",
      taskKind: "pay",
      title: "pay",
      values: { amount: "132.48", sender: "Musterkasse" },
      dueDate: "2026-11-15",
      amountCents: 13248,
      reminders: ["2026-11-08", "2026-11-12", "2026-11-14"],
    });
  });

  it("creates no pay task for direct debit, only a note", () => {
    const debit = [...invoice, { key: "payment_method", value: "SEPA-Lastschrift" }];
    expect(summary(tasksForDocument("invoice", debit, options))).toEqual([
      "note:directDebit",
      "record",
    ]);
  });

  it("uses the letter text when no payment method was extracted", () => {
    expect(
      summary(tasksForDocument("invoice", invoice, { ...options, textMentionsDirectDebit: true })),
    ).toEqual(["note:directDebit", "record"]);
  });

  it("lets an explicit bank transfer win over a direct-debit mention in the text", () => {
    const transfer = [...invoice, { key: "payment_method", value: "Überweisung" }];
    expect(
      summary(tasksForDocument("invoice", transfer, { ...options, textMentionsDirectDebit: true })),
    ).toEqual(["pay:2026-11-15", "record"]);
  });
});

describe("appointment", () => {
  it("creates attend on the date and prepare the day before", () => {
    const actions = tasksForDocument(
      "appointment",
      fields({
        appointment_date: "2026-10-22",
        time: "09:30",
        location: "Zimmer 2.14",
        bring: "Reisepass",
      }),
      options,
    );
    expect(summary(actions)).toEqual(["attend:2026-10-22", "prepare:2026-10-21", "record"]);
    expect(actions[1]).toMatchObject({
      title: "prepare",
      values: { items: "Reisepass" },
      reminders: [],
    });
    expect(actions[0]).toMatchObject({ reminders: ["2026-10-15", "2026-10-19", "2026-10-21"] });
  });

  it("still creates a prepare task when nothing to bring is listed", () => {
    const actions = tasksForDocument(
      "appointment",
      fields({ appointment_date: "2026-10-22" }),
      options,
    );
    expect(actions[1]).toMatchObject({
      taskKind: "prepare",
      title: "prepareGeneric",
      dueDate: "2026-10-21",
    });
  });
});

describe("decision letter", () => {
  it("creates a respond task only if a deadline exists", () => {
    expect(
      summary(
        tasksForDocument(
          "decision_letter",
          fields({ sender: "BAföG-Amt", response_deadline: "2026-11-02" }),
          options,
        ),
      ),
    ).toEqual(["respond:2026-11-02", "record"]);
    expect(
      summary(tasksForDocument("decision_letter", fields({ sender: "BAföG-Amt" }), options)),
    ).toEqual(["record"]);
  });
});

describe("payslip, information and contract", () => {
  it("creates a work-day entry and no task for a payslip", () => {
    const actions = tasksForDocument(
      "payslip",
      fields({ period: "2026-09", full_days: "3", half_days: "11", total_hours: "63.5" }),
      options,
    );
    expect(actions).toEqual([
      { kind: "workDays", month: "2026-09", fullDays: 3, halfDays: 11, hours: "63.5" },
      { kind: "record" },
    ]);
  });

  it("creates nothing for information letters and contracts", () => {
    expect(tasksForDocument("information_only", fields({ sender: "Uni" }), options)).toEqual([
      { kind: "record" },
    ]);
    expect(tasksForDocument("contract", fields({ sender: "Vermieter" }), options)).toEqual([
      { kind: "record" },
    ]);
  });
});

describe("payment method and direct debit", () => {
  it("recognizes common wordings", () => {
    expect(parsePaymentMethod("SEPA-Lastschrift")).toBe("direct_debit");
    expect(parsePaymentMethod("Der Betrag wird von Ihrem Konto abgebucht")).toBe("direct_debit");
    expect(parsePaymentMethod("Direct debit")).toBe("direct_debit");
    expect(parsePaymentMethod("Überweisung")).toBe("transfer");
    expect(parsePaymentMethod("Bitte überweisen Sie")).toBe("transfer");
    expect(parsePaymentMethod("bar")).toBeNull();
    expect(parsePaymentMethod(null)).toBeNull();
  });

  it("detects direct debit in letter text", () => {
    expect(textMentionsDirectDebit("Der Abschlag wird per SEPA-Lastschrift eingezogen.")).toBe(
      true,
    );
    expect(textMentionsDirectDebit("Bitte überweisen Sie den Betrag bis zum 15.11.2026.")).toBe(
      false,
    );
    expect(textMentionsDirectDebit("Nach Ihrem Einzug am 01.10. ziehen wir Bilanz.")).toBe(false);
  });

  it("combines field and text", () => {
    expect(isDirectDebit("Lastschrift", false)).toBe(true);
    expect(isDirectDebit(null, true)).toBe(true);
    expect(isDirectDebit("Überweisung", true)).toBe(false);
    expect(isDirectDebit(null, false)).toBe(false);
  });
});

describe("reminderDates", () => {
  it("skips reminders today or in the past and ignores duplicates", () => {
    expect(reminderDates("2026-10-06", [7, 3, 1, 1], "2026-10-04")).toEqual(["2026-10-05"]);
    expect(reminderDates("2026-10-05", [1], "2026-10-04")).toEqual([]);
    expect(reminderDates(null, [7], "2026-10-04")).toEqual([]);
  });
});

describe("payslip without day breakdown", () => {
  it("creates no work entry when the days are not stated, only a note", () => {
    const actions = tasksForDocument(
      "payslip",
      fields({ period: "2026-09", total_hours: "80", full_days: null, half_days: null }),
      options,
    );
    expect(actions).toEqual([{ kind: "note", reason: "workDaysNotStated" }, { kind: "record" }]);
  });

  it("never turns missing days into 0", () => {
    const actions = tasksForDocument(
      "payslip",
      fields({ period: "2026-09", full_days: "3", half_days: null }),
      options,
    );
    expect(actions.some((a) => a.kind === "workDays")).toBe(false);
  });
});
