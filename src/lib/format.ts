import { timeZone, type Locale } from "@/i18n/config";

/** Formats a calendar date for display, e.g. "03.10.2026" (de) or "03/10/2026" (en). */
export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).format(date);
}
