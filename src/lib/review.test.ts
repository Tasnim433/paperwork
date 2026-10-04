import { describe, expect, it } from "vitest";

import {
  canConfirm,
  displayValue,
  documentChecks,
  editedKeys,
  isSameLetter,
  nextInQueue,
  plannedActions,
  validateReview,
  type StoredField,
} from "./review";

const stored = (
  key: string,
  value: string | null,
  located = true,
  confidence = 0.95,
): StoredField => ({
  key,
  value,
  located,
  confidence,
});

// Letter 05: everything valid except the IBAN, which fails its checksum.
const utility: StoredField[] = [
  stored("sender", "Hausverwaltung Muster"),
  stored("letter_date", "2026-09-24"),
  stored("amount", "86.20"),
  stored("due_date", "2026-10-31"),
  stored("reference", "MV-0412"),
  stored("iban", "DE12 3704 0044 0532 0130 00"),
  stored("period", "01.01.2025 bis 31.12.2025"),
];

describe("displayValue", () => {
  it("shows dates and amounts in the user's format", () => {
    expect(displayValue("date", "2026-11-15", "de")).toBe("15.11.2026");
    expect(displayValue("date", "2026-11-15", "en")).toBe("15 Nov 2026");
    expect(displayValue("amount", "132.48", "de")).toBe("132,48");
    expect(displayValue("amount", "132.48", "en")).toBe("132.48");
  });

  it("leaves unparsed and other values as they are", () => {
    expect(displayValue("date", "31.02.2026", "de")).toBe("31.02.2026");
    expect(displayValue("time", "09:30", "de")).toBe("09:30");
    expect(displayValue("text", null, "de")).toBe("");
  });
});

describe("validateReview", () => {
  it("re-validates stored values unchanged", () => {
    const results = validateReview("invoice", utility, {}, "de");
    expect(results.find((r) => r.key === "iban")).toMatchObject({
      state: "check",
      rule: "iban.invalid",
    });
    expect(results.filter((r) => r.state !== "valid")).toHaveLength(1);
  });

  it("validates a corrected value live with the pipeline rules", () => {
    const results = validateReview(
      "invoice",
      utility,
      { iban: "DE89 3704 0044 0532 0130 00" },
      "de",
    );
    expect(results.find((r) => r.key === "iban")).toMatchObject({
      state: "valid",
      value: "DE89370400440532013000",
    });
    expect(canConfirm(results, false)).toBe(true);
  });

  it("accepts corrected values not found in the document (the user confirmed them)", () => {
    const fields = [...utility.filter((f) => f.key !== "amount"), stored("amount", "86.20", false)];
    expect(validateReview("invoice", fields, {}, "de").find((r) => r.key === "amount")?.rule).toBe(
      "source.notFound",
    );
    expect(
      validateReview("invoice", fields, { amount: "86,21" }, "de").find((r) => r.key === "amount"),
    ).toMatchObject({ state: "valid", value: "86.21" });
  });

  it("treats the displayed format as unchanged", () => {
    expect(
      editedKeys("invoice", utility, { amount: "86,20", due_date: "31.10.2026" }, "de"),
    ).toEqual([]);
    expect(editedKeys("invoice", utility, { amount: "86,30" }, "de")).toEqual(["amount"]);
  });

  it("marks fields of a newly chosen type as missing until filled", () => {
    const results = validateReview("appointment", utility, {}, "de");
    expect(results.find((r) => r.key === "appointment_date")?.state).toBe("missing");
    expect(results.find((r) => r.key === "sender")?.state).toBe("valid");
  });
});

describe("documentChecks", () => {
  it("lists which checks pass", () => {
    const results = validateReview("invoice", utility, {}, "de");
    expect(documentChecks(results, false)).toEqual([
      { key: "required", passed: true },
      { key: "formats", passed: false },
      { key: "found", passed: true },
      { key: "deadline", passed: true },
      { key: "duplicate", passed: true },
    ]);
  });

  it("blocks confirmation for duplicates", () => {
    const results = validateReview("invoice", utility, { iban: "DE89370400440532013000" }, "de");
    expect(documentChecks(results, true).at(-1)).toEqual({ key: "duplicate", passed: false });
    expect(canConfirm(results, true)).toBe(false);
  });
});

describe("plannedActions", () => {
  const options = { reminderOffsetDays: [7, 3, 1], today: "2026-10-04" };

  it("plans a payment task with reminders for an invoice", () => {
    const results = validateReview("invoice", utility, { iban: "DE89370400440532013000" }, "de");
    expect(plannedActions("invoice", results, options)).toEqual([
      {
        kind: "task",
        taskKind: "pay",
        title: "pay",
        values: { amount: "86.20", sender: "Hausverwaltung Muster" },
        dueDate: "2026-10-31",
        amountCents: 8620,
        reminders: ["2026-10-24", "2026-10-28", "2026-10-30"],
      },
      { kind: "record" },
    ]);
  });

  it("skips reminders in the past", () => {
    const results = [
      { key: "due_date", value: "2026-10-06" },
      { key: "amount", value: "55.08" },
    ];
    const [task] = plannedActions("invoice", results, options);
    expect(task.kind === "task" && task.reminders).toEqual(["2026-10-05"]);
  });

  it("plans attend and prepare tasks for an appointment", () => {
    const results = [
      { key: "appointment_date", value: "2026-10-22" },
      { key: "time", value: "09:30" },
      { key: "location", value: "Zimmer 2.14" },
      { key: "bring", value: "Reisepass" },
    ];
    const actions = plannedActions("appointment", results, options);
    expect(actions.map((a) => (a.kind === "task" ? `${a.taskKind}:${a.dueDate}` : a.kind))).toEqual(
      ["attend:2026-10-22", "prepare:2026-10-21", "record"],
    );
  });

  it("plans a work-day entry for a payslip and nothing for information letters", () => {
    const payslip = [
      { key: "period", value: "2026-09" },
      { key: "full_days", value: "3" },
      { key: "half_days", value: "11" },
      { key: "total_hours", value: "63.5" },
    ];
    expect(plannedActions("payslip", payslip, options)[0]).toEqual({
      kind: "workDays",
      month: "2026-09",
      fullDays: 3,
      halfDays: 11,
      hours: "63.5",
    });
    expect(plannedActions("information_only", [], options)).toEqual([{ kind: "record" }]);
  });
});

describe("isSameLetter", () => {
  const invoice = (values: Record<string, string | null>) => ({ type: "invoice" as const, values });
  const base = {
    sender: "Beitragsstelle Musterland",
    amount: "55.08",
    due_date: "2026-10-15",
    reference: "482 113 907",
  };

  it("detects the same letter uploaded twice", () => {
    expect(
      isSameLetter(invoice(base), invoice({ ...base, sender: "beitragsstelle musterland " })),
    ).toBe(true);
  });

  it("tells different letters apart", () => {
    expect(isSameLetter(invoice(base), invoice({ ...base, due_date: "2027-01-15" }))).toBe(false);
    expect(isSameLetter(invoice(base), { type: "appointment", values: base })).toBe(false);
    expect(isSameLetter(invoice({ sender: "X" }), invoice({ sender: "X" }))).toBe(false);
  });
});

describe("nextInQueue", () => {
  it("opens the next document, or the previous one at the end", () => {
    expect(nextInQueue(["a", "b", "c"], "a")).toBe("b");
    expect(nextInQueue(["a", "b", "c"], "b")).toBe("c");
    expect(nextInQueue(["a", "b", "c"], "c")).toBe("b");
  });

  it("returns null when the queue is empty afterwards", () => {
    expect(nextInQueue(["a"], "a")).toBeNull();
    expect(nextInQueue([], "a")).toBeNull();
  });

  it("starts at the top when the document is not in the queue", () => {
    expect(nextInQueue(["a", "b"], "x")).toBe("a");
  });
});
