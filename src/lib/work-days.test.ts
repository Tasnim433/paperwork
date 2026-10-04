import { describe, expect, it } from "vitest";

import { availableYears, levelFor, workDaysSummary, type WorkEntry } from "./work-days";

const entry = (month: string, fullDays: number, halfDays: number): WorkEntry => ({
  month,
  fullDays,
  halfDays,
});

describe("workDaysSummary", () => {
  it("counts full days, half days and full-day equivalents for the year", () => {
    // Payslip 04: 3 full + 11 half = 8.5 full-day equivalents.
    const summary = workDaysSummary([entry("2026-09-01", 3, 11)], 2026);
    expect(summary).toMatchObject({
      fullDays: 3,
      halfDays: 11,
      used: 8.5,
      remaining: 131.5,
      over: 0,
      level: "ok",
    });
    expect(summary.months[8]).toEqual({ month: 9, fullDays: 3, halfDays: 11, used: 8.5 });
    expect(summary.months[0]).toEqual({ month: 1, fullDays: 0, halfDays: 0, used: 0 });
  });

  it("adds several entries for the same month (e.g. two employers)", () => {
    const summary = workDaysSummary([entry("2026-03-01", 2, 1), entry("2026-03-01", 1, 3)], 2026);
    expect(summary.months[2]).toEqual({ month: 3, fullDays: 3, halfDays: 4, used: 5 });
  });

  it("ignores entries of other years", () => {
    const summary = workDaysSummary([entry("2025-12-01", 10, 0), entry("2027-01-01", 5, 0)], 2026);
    expect(summary.used).toBe(0);
  });

  it("treats 280 half days like 140 full days", () => {
    const summary = workDaysSummary([entry("2026-05-01", 0, 280)], 2026);
    expect(summary).toMatchObject({ used: 140, remaining: 0, level: "limit", ratio: 1 });
  });

  it("reports days over the limit and never negative remaining", () => {
    const summary = workDaysSummary([entry("2026-06-01", 150, 4)], 2026);
    expect(summary).toMatchObject({ used: 152, remaining: 0, over: 12, level: "limit" });
  });

  it("ignores negative or malformed values", () => {
    const summary = workDaysSummary([entry("2026-02-01", -3, -1), entry("2026-13-01", 9, 9)], 2026);
    expect(summary.used).toBe(0);
  });
});

describe("levelFor", () => {
  it("warns from 80 % and reaches the limit at 100 %", () => {
    expect(levelFor(111.5)).toBe("ok");
    expect(levelFor(112)).toBe("warning"); // 80 % of 140
    expect(levelFor(139.5)).toBe("warning");
    expect(levelFor(140)).toBe("limit");
  });
});

describe("availableYears", () => {
  it("lists years with entries and the current year, newest first", () => {
    expect(availableYears([{ month: "2025-11-01" }, { month: "2026-02-01" }], 2026)).toEqual([
      2026, 2025,
    ]);
    expect(availableYears([], 2026)).toEqual([2026]);
  });
});
