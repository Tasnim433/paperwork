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
