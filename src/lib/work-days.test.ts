import { describe, expect, it } from "vitest";

import {
  availableYears,
  levelFor,
  periodMonth,
  resolveYear,
  validateManualEntry,
  workDaysSummary,
  yearsWithData,
  type WorkEntry,
} from "./work-days";

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

describe("resolveYear / yearsWithData", () => {
  const entries = [{ month: "2025-11-01" }, { month: "2024-03-01" }, { month: "2025-02-01" }];

  it("defaults to the most recent year with entries, not the current year", () => {
    expect(resolveYear(null, entries, 2026)).toBe(2025);
    expect(yearsWithData(entries)).toEqual([2025, 2024]);
  });

  it("uses the requested year when it is offered", () => {
    expect(resolveYear(2024, entries, 2026)).toBe(2024);
    expect(resolveYear(2026, entries, 2026)).toBe(2026);
  });

  it("ignores years that are not offered", () => {
    expect(resolveYear(1999, entries, 2026)).toBe(2025);
  });

  it("falls back to the current year without entries", () => {
    expect(resolveYear(null, [], 2026)).toBe(2026);
    expect(yearsWithData([])).toEqual([]);
  });
});

describe("validateManualEntry", () => {
  it("accepts whole days that fit into the month", () => {
    expect(validateManualEntry({ month: "2026-09", fullDays: 3, halfDays: 11 })).toEqual([]);
    expect(validateManualEntry({ month: "2026-09", fullDays: 0, halfDays: 0 })).toEqual([]);
  });

  it("rejects invalid months and counts", () => {
    expect(validateManualEntry({ month: "2026-13", fullDays: 1, halfDays: 1 })).toEqual(["month"]);
    expect(validateManualEntry({ month: "09/2026", fullDays: 1, halfDays: 1 })).toEqual(["month"]);
    expect(validateManualEntry({ month: "2026-09", fullDays: -1, halfDays: 1.5 })).toEqual([
      "fullDays",
      "halfDays",
    ]);
  });

  it("rejects more days than the month has", () => {
    expect(validateManualEntry({ month: "2026-02", fullDays: 20, halfDays: 9 })).toEqual([
      "tooManyDays",
    ]);
    expect(validateManualEntry({ month: "2028-02", fullDays: 20, halfDays: 9 })).toEqual([]); // leap year
  });
});

describe("periodMonth", () => {
  it("returns validated payslip periods only", () => {
    expect(periodMonth("2026-09")).toBe("2026-09");
    expect(periodMonth("09/2026")).toBeNull();
    expect(periodMonth("2026-13")).toBeNull();
    expect(periodMonth(null)).toBeNull();
  });
});
