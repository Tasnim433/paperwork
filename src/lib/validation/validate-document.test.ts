import { describe, expect, it } from "vitest";

import { flaggedCount, validateDocument, type FieldInput } from "./validate-document";

const found = (value: string, confidence = 0.95): FieldInput => ({
  value,
  confidence,
  located: true,
});

const byKey = (results: ReturnType<typeof validateDocument>) =>
  Object.fromEntries(results.map((r) => [r.key, r]));

describe("validateDocument", () => {
  it("normalizes valid invoice fields", () => {
    const results = byKey(
      validateDocument("invoice", {
        sender: found("Musterkasse Krankenversicherung"),
        letter_date: found("29.09.2026"),
        amount: found("132,48 €"),
        due_date: found("15. November 2026"),
        reference: found("X123456789"),
        iban: found("DE89 3704 0044 0532 0130 00"),
      }),
    );
    expect(results.letter_date).toMatchObject({ value: "2026-09-29", state: "valid" });
    expect(results.amount).toMatchObject({ value: "132.48", state: "valid" });
    expect(results.due_date).toMatchObject({ value: "2026-11-15", state: "valid" });
    expect(results.iban).toMatchObject({ value: "DE89370400440532013000", state: "valid" });
    expect(results.reference.state).toBe("valid");
  });

  it("marks missing required fields and leaves missing optional fields valid and empty", () => {
    const results = byKey(validateDocument("invoice", { sender: found("Musterkasse") }));
    expect(results.amount).toMatchObject({ value: null, state: "missing", rule: "required" });
    expect(results.due_date).toMatchObject({ state: "missing", rule: "required" });
    expect(results.iban).toMatchObject({ value: null, state: "valid", rule: null });
  });

  it("treats blank values as not found", () => {
    const results = byKey(validateDocument("invoice", { amount: found("   ") }));
    expect(results.amount.state).toBe("missing");
  });

  it("flags values that do not parse, keeping the raw value", () => {
    const results = byKey(
      validateDocument("appointment", {
        sender: found("Stadt Musterstadt"),
        appointment_date: found("22.10.2026"),
        time: found("09:3O"),
        location: found("Zimmer 2.14"),
      }),
    );
    expect(results.time).toMatchObject({ value: "09:3O", state: "check", rule: "time.invalid" });
    expect(results.case_number.state).toBe("valid");
  });

  it("flags values whose source text was not found in the document", () => {
    const results = byKey(
      validateDocument("invoice", { amount: { value: "132,48", confidence: 0.9, located: false } }),
    );
    expect(results.amount).toMatchObject({ state: "check", rule: "source.notFound" });
  });

  it("flags low-confidence values", () => {
    const results = byKey(validateDocument("invoice", { amount: found("132,48", 0.3) }));
    expect(results.amount).toMatchObject({ state: "check", rule: "confidence.low" });
  });

  it("flags deadlines before the letter date", () => {
    const results = byKey(
      validateDocument("invoice", {
        letter_date: found("29.09.2026"),
        due_date: found("15.09.2026"),
      }),
    );
    expect(results.due_date).toMatchObject({ state: "check", rule: "date.beforeLetterDate" });
  });

  it("accepts a deadline on the letter date itself", () => {
    const results = byKey(
      validateDocument("invoice", {
        letter_date: found("29.09.2026"),
        due_date: found("29.09.2026"),
      }),
    );
    expect(results.due_date.state).toBe("valid");
  });

  it("uses the sender for reference rules", () => {
    const results = byKey(
      validateDocument("invoice", { sender: found("Beitragsservice"), reference: found("12345") }),
    );
    expect(results.reference).toMatchObject({ state: "check", rule: "reference.broadcastingFee" });
  });

  it("validates payslip numbers and months", () => {
    const results = byKey(
      validateDocument("payslip", {
        sender: found("Café Am Inn GmbH"),
        period: found("09/2026"),
        total_hours: found("64,0"),
        full_days: found("3"),
        half_days: found("elf"),
      }),
    );
    expect(results.period).toMatchObject({ value: "2026-09", state: "valid" });
    expect(results.total_hours).toMatchObject({ value: "64", state: "valid" });
    expect(results.half_days).toMatchObject({ state: "check", rule: "integer.invalid" });
  });

  it("counts flagged fields", () => {
    const results = validateDocument("invoice", { sender: found("Musterkasse") });
    expect(flaggedCount(results)).toBe(2); // amount and due_date missing
  });
});
