import { describe, expect, it } from "vitest";

import { overviewMetrics, summaryKey } from "./summary";

const today = "2026-10-03";
const open = (dueDate: string | null) => ({ status: "open" as const, dueDate });

describe("overviewMetrics", () => {
  it("counts open, overdue, due within 7 days and documents to review", () => {
    const tasks = [
      open("2026-10-01"), // overdue
      open("2026-10-03"), // today
      open("2026-10-10"), // in 7 days
      open("2026-10-31"), // later
      open(null),
    ];
    expect(overviewMetrics(tasks, 2, today)).toEqual({
      open: 5,
      overdue: 1,
      dueThisWeek: 2,
      toReview: 2,
    });
  });

  it("returns zeros for no tasks", () => {
    expect(overviewMetrics([], 0, today)).toEqual({
      open: 0,
      overdue: 0,
      dueThisWeek: 0,
      toReview: 0,
    });
  });
});

describe("summaryKey", () => {
  it("mentions both overdue tasks and documents to review", () => {
    expect(summaryKey({ overdue: 1, toReview: 2 })).toBe("overdueAndReview");
  });

  it("mentions only what applies", () => {
    expect(summaryKey({ overdue: 3, toReview: 0 })).toBe("overdue");
    expect(summaryKey({ overdue: 0, toReview: 1 })).toBe("review");
  });

  it("says all caught up when nothing is pending", () => {
    expect(summaryKey({ overdue: 0, toReview: 0 })).toBe("caughtUp");
  });
});
