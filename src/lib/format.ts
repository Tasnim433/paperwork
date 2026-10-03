import { timeZone, type Locale } from "@/i18n/config";

import type { IsoDate } from "./dates";

const intlLocale: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

const dateOptions: Record<Locale, Intl.DateTimeFormatOptions> = {
  de: { day: "2-digit", month: "2-digit", year: "numeric" },
  en: { day: "numeric", month: "short", year: "numeric" },
};

/**
 * Formats a date for display: "15.11.2026" (de) or "15 Nov 2026" (en).
 * Accepts a calendar date ("YYYY-MM-DD") or a point in time (shown in German time).
 */
export function formatDate(date: Date | IsoDate, locale: Locale): string {
  const options = { ...dateOptions[locale], timeZone };
  // Calendar dates are anchored at noon UTC so they never shift a day in Europe/Berlin.
  const value = typeof date === "string" ? new Date(`${date}T12:00:00Z`) : date;
  return new Intl.DateTimeFormat(intlLocale[locale], options).format(value);
}

/** Formats a date and time, e.g. "02.10.2026, 18:04" (de). */
export function formatDateTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    ...dateOptions[locale],
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

/** Formats an amount in euro cents: "132,48 €" (de) or "€132.48" (en). */
export function formatCurrency(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale[locale], { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
}
