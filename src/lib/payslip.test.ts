import { describe, expect, it } from "vitest";

import { sanitizeDayBreakdown } from "./payslip";

const value = (v: string | null) => ({ value: v, sourceText: v, confidence: v ? 0.9 : 0 });

describe("sanitizeDayBreakdown", () => {
  it("turns 0 / 0 days with worked hours into empty values", () => {
    const result = sanitizeDayBreakdown({
      total_hours: value("80"),
      full_days: value("0"),
      half_days: value("0"),
    });
    expect(result.full_days).toEqual({ value: null, sourceText: null, confidence: 0 });
    expect(result.half_days).toEqual({ value: null, sourceText: null, confidence: 0 });
  });

  it("keeps real day counts, including a single 0", () => {
    const real = { total_hours: value("63,5"), full_days: value("3"), half_days: value("11") };
    expect(sanitizeDayBreakdown(real)).toBe(real);
    const oneZero = { total_hours: value("26"), full_days: value("0"), half_days: value("8") };
    expect(sanitizeDayBreakdown(oneZero)).toBe(oneZero);
  });

  it("keeps 0 / 0 when no hours were worked", () => {
    const none = { total_hours: value("0"), full_days: value("0"), half_days: value("0") };
    expect(sanitizeDayBreakdown(none)).toBe(none);
  });

  it("leaves empty values empty", () => {
    const empty = { total_hours: value("160"), full_days: value(null), half_days: value(null) };
    expect(sanitizeDayBreakdown(empty)).toBe(empty);
  });
});
