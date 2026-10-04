/**
 * Payslips without a per-day breakdown (e.g. monthly salary slips) do not state
 * how many days had more or less than 4 hours. Those counts must stay empty, so
 * the user can mark them "not stated" instead of confirming made-up numbers.
 */

/** Fields that may be marked "not stated in document" in Review. */
export const DAY_COUNT_FIELDS = ["full_days", "half_days"] as const;

type Extracted = { value: string | null; sourceText: string | null; confidence: number };

const isZero = (value: string | null | undefined) =>
  value !== null && value !== undefined && /^0+$/.test(value.trim());
const isPositive = (value: string | null | undefined) => {
  const number = Number(value?.trim().replace(",", "."));
  return Number.isFinite(number) && number > 0;
};

/**
 * Deterministic guard on the model's answer: "0 full days and 0 half days" while
 * hours were worked is not a day breakdown but a missing one, so both become empty.
 */
export function sanitizeDayBreakdown<T extends Record<string, Extracted>>(values: T): T {
  const full = values.full_days?.value;
  const half = values.half_days?.value;
  if (!(isZero(full) && isZero(half) && isPositive(values.total_hours?.value))) return values;
  const empty: Extracted = { value: null, sourceText: null, confidence: 0 };
  return { ...values, full_days: empty, half_days: empty };
}
