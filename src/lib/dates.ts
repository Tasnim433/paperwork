import { timeZone } from "@/i18n/config";

/** A calendar date as stored in Postgres `date` columns: "YYYY-MM-DD". */
export type IsoDate = string;

const DAY_MS = 86_400_000;

/** Today's calendar date in Germany. */
export function todayIso(now: Date = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** Adds calendar days to a date. */
export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export const DUE_SOON_DAYS = 7;

export type DueStatus =
  | { kind: "done" }
  | { kind: "none" }
  | { kind: "overdue"; days: number }
  | { kind: "today" }
  | { kind: "soon"; days: number }
  | { kind: "later"; days: number };

/** How urgent a task is relative to today. "soon" means due within the next 7 days. */
export function dueStatus(
  task: { status: "open" | "done"; dueDate: IsoDate | null },
  today: IsoDate,
): DueStatus {
  if (task.status === "done") return { kind: "done" };
  if (!task.dueDate) return { kind: "none" };
  const days = daysBetween(today, task.dueDate);
  if (days < 0) return { kind: "overdue", days: -days };
  if (days === 0) return { kind: "today" };
  if (days <= DUE_SOON_DAYS) return { kind: "soon", days };
  return { kind: "later", days };
}

export type TimeOfDay = "morning" | "afternoon" | "evening";

/** Part of the day in Germany, for the greeting. */
export function timeOfDay(now: Date = new Date()): TimeOfDay {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now),
  );
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

/** The instant of a wall-clock time on a calendar date in Germany, e.g. 08:00 on 2026-10-24. */
export function berlinDateTime(date: IsoDate, time: string): Date {
  const guess = Date.parse(`${date}T${time}:00Z`);
  // Offset of Berlin from UTC at that moment ("GMT+2" in summer, "GMT+1" in winter).
  const offsetName =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(new Date(guess))
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT+1";
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(offsetName);
  const offsetMinutes = match
    ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0))
    : 0;
  return new Date(guess - offsetMinutes * 60_000);
}
