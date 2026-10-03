import { dueStatus, type IsoDate } from "./dates";

export type OverviewMetrics = {
  open: number;
  overdue: number;
  dueThisWeek: number;
  toReview: number;
};

/** The four numbers on the overview. "Due in 7 days" includes today, excludes overdue. */
export function overviewMetrics(
  openTasks: Array<{ status: "open" | "done"; dueDate: IsoDate | null }>,
  toReview: number,
  today: IsoDate,
): OverviewMetrics {
  let overdue = 0;
  let dueThisWeek = 0;
  for (const task of openTasks) {
    const status = dueStatus(task, today);
    if (status.kind === "overdue") overdue++;
    else if (status.kind === "today" || status.kind === "soon") dueThisWeek++;
  }
  return { open: openTasks.length, overdue, dueThisWeek, toReview };
}

export type SummaryKey = "overdueAndReview" | "overdue" | "review" | "caughtUp";

/** Which summary sentence to show under the greeting. */
export function summaryKey({ overdue, toReview }: Pick<OverviewMetrics, "overdue" | "toReview">) {
  if (overdue > 0 && toReview > 0) return "overdueAndReview" satisfies SummaryKey;
  if (overdue > 0) return "overdue" satisfies SummaryKey;
  if (toReview > 0) return "review" satisfies SummaryKey;
  return "caughtUp" satisfies SummaryKey;
}
