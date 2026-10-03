import { describe, expect, it } from "vitest";

import { addDays, daysBetween, dueStatus, timeOfDay, todayIso } from "./dates";

describe("todayIso", () => {
  it("uses the German calendar date", () => {
    // 23:30 UTC on 3 Oct is already 4 Oct in Berlin (CEST, UTC+2).
    expect(todayIso(new Date("2026-10-03T23:30:00Z"))).toBe("2026-10-04");
    expect(todayIso(new Date("2026-10-03T10:00:00Z"))).toBe("2026-10-03");
  });
});

describe("daysBetween / addDays", () => {
  it("counts whole calendar days", () => {
    expect(daysBetween("2026-10-03", "2026-10-15")).toBe(12);
    expect(daysBetween("2026-10-03", "2026-10-01")).toBe(-2);
  });

  it("is not affected by daylight saving changes", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
  });

  it("adds and subtracts days across month ends", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });
});

describe("dueStatus", () => {
  const today = "2026-10-03";
  const open = (dueDate: string | null) => ({ status: "open" as const, dueDate });

  it("marks completed tasks as done regardless of date", () => {
    expect(dueStatus({ status: "done", dueDate: "2026-09-01" }, today)).toEqual({ kind: "done" });
  });

  it("handles tasks without a due date", () => {
    expect(dueStatus(open(null), today)).toEqual({ kind: "none" });
  });

  it("reports overdue days", () => {
    expect(dueStatus(open("2026-10-01"), today)).toEqual({ kind: "overdue", days: 2 });
    expect(dueStatus(open("2026-10-02"), today)).toEqual({ kind: "overdue", days: 1 });
  });

  it("distinguishes today, within 7 days and later", () => {
    expect(dueStatus(open("2026-10-03"), today)).toEqual({ kind: "today" });
    expect(dueStatus(open("2026-10-10"), today)).toEqual({ kind: "soon", days: 7 });
    expect(dueStatus(open("2026-10-11"), today)).toEqual({ kind: "later", days: 8 });
  });
});

describe("timeOfDay", () => {
  it("uses the hour in Germany", () => {
    expect(timeOfDay(new Date("2026-10-03T05:00:00Z"))).toBe("morning"); // 07:00
    expect(timeOfDay(new Date("2026-10-03T10:00:00Z"))).toBe("afternoon"); // 12:00
    expect(timeOfDay(new Date("2026-10-03T16:00:00Z"))).toBe("evening"); // 18:00
    expect(timeOfDay(new Date("2026-10-03T01:00:00Z"))).toBe("evening"); // 03:00
  });
});
