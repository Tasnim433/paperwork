/**
 * Work-day limit for non-EU students in Germany: 140 full days or 280 half days
 * per calendar year. A day with more than 4 hours counts as a full day, up to 4
 * hours as a half day; two half days equal one full day.
 */

export const FULL_DAY_LIMIT = 140;
export const WARNING_RATIO = 0.8;

export type WorkEntry = {
  /** First day of the month the entry covers, "YYYY-MM-DD". */
  month: string;
  fullDays: number;
  halfDays: number;
};

export type MonthTotals = {
  /** 1-12 */
  month: number;
  fullDays: number;
  halfDays: number;
  /** Full-day equivalents: full + half / 2. */
  used: number;
};

export type WorkDaysLevel = "ok" | "warning" | "limit";

export type WorkDaysSummary = {
  year: number;
  fullDays: number;
  halfDays: number;
  /** Full-day equivalents used: full + half / 2. */
  used: number;
  limit: number;
  /** Full-day equivalents left before the limit (never negative). */
  remaining: number;
  /** Full-day equivalents over the limit (0 when within). */
  over: number;
  /** used / limit, not capped (1.1 = 110 %). */
  ratio: number;
  /** "warning" from 80 %, "limit" from 100 %. */
  level: WorkDaysLevel;
  months: MonthTotals[];
};

export function levelFor(used: number, limit = FULL_DAY_LIMIT): WorkDaysLevel {
  if (used >= limit) return "limit";
  if (used >= limit * WARNING_RATIO) return "warning";
  return "ok";
}

/** Totals for one calendar year from work entries (entries of other years are ignored). */
export function workDaysSummary(
  entries: WorkEntry[],
  year: number,
  limit = FULL_DAY_LIMIT,
): WorkDaysSummary {
  const months: MonthTotals[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    fullDays: 0,
    halfDays: 0,
    used: 0,
  }));

  for (const entry of entries) {
    const [entryYear, entryMonth] = entry.month.split("-").map(Number);
    if (entryYear !== year || !(entryMonth >= 1 && entryMonth <= 12)) continue;
    const totals = months[entryMonth - 1];
    totals.fullDays += Math.max(0, entry.fullDays);
    totals.halfDays += Math.max(0, entry.halfDays);
    totals.used = totals.fullDays + totals.halfDays / 2;
  }

  const fullDays = months.reduce((sum, m) => sum + m.fullDays, 0);
  const halfDays = months.reduce((sum, m) => sum + m.halfDays, 0);
  const used = fullDays + halfDays / 2;

  return {
    year,
    fullDays,
    halfDays,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    over: Math.max(0, used - limit),
    ratio: used / limit,
    level: levelFor(used, limit),
    months,
  };
}

/** Years to offer: those with entries plus the current one, newest first. */
export function availableYears(entries: Pick<WorkEntry, "month">[], currentYear: number): number[] {
  const years = new Set(entries.map((entry) => Number(entry.month.slice(0, 4))));
  years.add(currentYear);
  return [...years].filter((year) => Number.isInteger(year)).sort((a, b) => b - a);
}

/** Years that have work entries, newest first. */
export function yearsWithData(entries: Pick<WorkEntry, "month">[]): number[] {
  return [...new Set(entries.map((entry) => Number(entry.month.slice(0, 4))))]
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => b - a);
}

/**
 * The year to show: the requested one if it is offered, otherwise the most
 * recent year with entries, otherwise the current year.
 */
export function resolveYear(
  requested: number | null,
  entries: Pick<WorkEntry, "month">[],
  currentYear: number,
): number {
  const offered = availableYears(entries, currentYear);
  if (requested !== null && offered.includes(requested)) return requested;
  return yearsWithData(entries)[0] ?? currentYear;
}

export type ManualEntryError = "month" | "fullDays" | "halfDays" | "tooManyDays";

/**
 * Checks days typed in by the user for one month: whole numbers, not negative,
 * and together not more days than the month has.
 */
export function validateManualEntry(input: {
  month: string;
  fullDays: number;
  halfDays: number;
}): ManualEntryError[] {
  const errors: ManualEntryError[] = [];
  const match = /^(\d{4})-(\d{2})$/.exec(input.month);
  const monthNumber = match ? Number(match[2]) : 0;
  if (!match || monthNumber < 1 || monthNumber > 12) errors.push("month");
  const isCount = (value: number) => Number.isInteger(value) && value >= 0 && value <= 31;
  if (!isCount(input.fullDays)) errors.push("fullDays");
  if (!isCount(input.halfDays)) errors.push("halfDays");
  if (errors.length === 0) {
    const daysInMonth = new Date(Date.UTC(Number(match![1]), monthNumber, 0)).getUTCDate();
    if (input.fullDays + input.halfDays > daysInMonth) errors.push("tooManyDays");
  }
  return errors;
}

/** The payslip period as "YYYY-MM" when it is in that (validated) form, else null. */
export function periodMonth(period: string | null | undefined): string | null {
  return period && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? period : null;
}
