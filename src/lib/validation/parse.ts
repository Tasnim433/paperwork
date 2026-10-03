/**
 * Pure parsers for values found in German and English letters. Each returns a
 * normalized value, or null when the input is not a valid value of that kind.
 */

const germanMonths: Record<string, number> = {
  januar: 1,
  jan: 1,
  jänner: 1,
  jän: 1,
  februar: 2,
  feb: 2,
  märz: 3,
  maerz: 3,
  mär: 3,
  mrz: 3,
  april: 4,
  apr: 4,
  mai: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  dezember: 12,
  dez: 12,
};

const englishMonths: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  mar: 3,
  may: 5,
  june: 6,
  july: 7,
  october: 10,
  oct: 10,
  december: 12,
  dec: 12,
};

const monthNames: Record<string, number> = { ...englishMonths, ...germanMonths };

function monthFromName(name: string): number | undefined {
  return monthNames[name.toLowerCase().replace(/\.$/, "")];
}

function expandYear(year: string): number {
  const value = Number(year);
  return year.length === 2 ? 2000 + value : value;
}

function isoDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parses a calendar date to "YYYY-MM-DD". Accepts ISO dates, German numeric
 * dates (15.11.2026, 15.11.26), and written months in German or English
 * (15. November 2026, 15 Nov 2026, November 15, 2026).
 */
export function parseDate(input: string): string | null {
  const value = input.trim().replace(/\s+/g, " ");

  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4}|\d{2})$/.exec(value);
  if (match) return isoDate(expandYear(match[3]), Number(match[2]), Number(match[1]));

  match = /^(\d{1,2})\.? ([A-Za-zÄÖÜäöü]+\.?),? (\d{4})$/.exec(value);
  if (match) {
    const month = monthFromName(match[2]);
    return month ? isoDate(Number(match[3]), month, Number(match[1])) : null;
  }

  match = /^([A-Za-z]+\.?) (\d{1,2}),? (\d{4})$/.exec(value);
  if (match) {
    const month = monthFromName(match[1]);
    return month ? isoDate(Number(match[3]), month, Number(match[2])) : null;
  }

  return null;
}

/** Parses a time of day to "HH:MM". Accepts 9:30, 09.30, 9 Uhr, 9:30 Uhr. */
export function parseTime(input: string): string | null {
  const match = /^(\d{1,2})(?:[:.](\d{2}))?(?:\s?(?:Uhr|h))?$/i.exec(input.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Parses a month to "YYYY-MM". Accepts 09/2026, 9.2026, 2026-09, September 2026, Sep 26. */
export function parseMonth(input: string): string | null {
  const value = input.trim().replace(/\s+/g, " ");
  const format = (year: number, month: number) =>
    month >= 1 && month <= 12 && year >= 1900 && year <= 2200
      ? `${year}-${String(month).padStart(2, "0")}`
      : null;

  let match = /^(\d{4})-(\d{1,2})$/.exec(value);
  if (match) return format(Number(match[1]), Number(match[2]));

  match = /^(\d{1,2})[/.](\d{4}|\d{2})$/.exec(value);
  if (match) return format(expandYear(match[2]), Number(match[1]));

  match = /^([A-Za-zÄÖÜäöü]+\.?) (\d{4}|\d{2})$/.exec(value);
  if (match) {
    const month = monthFromName(match[1]);
    return month ? format(expandYear(match[2]), month) : null;
  }
  return null;
}

/**
 * Parses an amount to integer cents. Understands German (1.234,56 €) and
 * English (€1,234.56) notation. A single separator followed by exactly three
 * digits is a thousands separator (1.234 = 1234), otherwise a decimal one.
 */
export function parseAmountCents(input: string): number | null {
  let value = input
    .trim()
    .replace(/\s+/g, "")
    .replace(/^(EUR|€)|(EUR|€)$/i, "")
    .replace(/,-$/, "");
  const negative = value.startsWith("-");
  if (negative) value = value.slice(1);
  if (!/^\d[\d.,]*$/.test(value)) return null;

  const lastDot = value.lastIndexOf(".");
  const lastComma = value.lastIndexOf(",");
  let integer: string;
  let fraction = "";

  if (lastDot >= 0 && lastComma >= 0) {
    // Both separators: the last one is the decimal separator, the other groups thousands.
    const decimalIndex = Math.max(lastDot, lastComma);
    const decimal = value[decimalIndex];
    const thousands = decimal === "." ? "," : ".";
    integer = value.slice(0, decimalIndex);
    fraction = value.slice(decimalIndex + 1);
    if (integer.includes(decimal) || !groupedCorrectly(integer, thousands)) return null;
    integer = integer.split(thousands).join("");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const separator = lastDot >= 0 ? "." : ",";
    const parts = value.split(separator);
    if (parts.length === 2 && parts[1].length !== 3) {
      [integer, fraction] = parts;
    } else if (groupedCorrectly(value, separator)) {
      integer = parts.join("");
    } else {
      return null;
    }
  } else {
    integer = value;
  }

  if (!/^\d+$/.test(integer) || !/^\d{0,2}$/.test(fraction)) return null;
  const cents = Number(integer) * 100 + Number(fraction.padEnd(2, "0") || "0");
  return negative ? -cents : cents;
}

function groupedCorrectly(value: string, separator: string): boolean {
  const groups = value.split(separator);
  return /^\d{1,3}$/.test(groups[0]) && groups.slice(1).every((group) => /^\d{3}$/.test(group));
}

/** Formats cents as a plain decimal string ("132.48"), the stored form of amounts. */
export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Parses a non-negative whole number. */
export function parseInteger(input: string): number | null {
  const value = input.trim();
  return /^\d{1,6}$/.test(value) ? Number(value) : null;
}

/** Parses a non-negative decimal number with either comma or dot ("64,5" or "64.5"). */
export function parseNumber(input: string): number | null {
  const value = input.trim().replace(",", ".");
  return /^\d{1,6}(\.\d{1,2})?$/.test(value) ? Number(value) : null;
}

const ibanLengths: Record<string, number> = {
  AT: 20,
  BE: 16,
  CH: 21,
  DE: 22,
  DK: 18,
  ES: 24,
  FI: 18,
  FR: 27,
  GB: 22,
  IE: 22,
  IT: 27,
  LU: 20,
  NL: 18,
  NO: 15,
  PL: 28,
  PT: 25,
  SE: 24,
};

/** Validates an IBAN (length per country, ISO 13616 mod-97 checksum). Returns it without spaces. */
export function parseIban(input: string): string | null {
  const iban = input.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return null;
  const expected = ibanLengths[iban.slice(0, 2)];
  if (expected && iban.length !== expected) return null;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1 ? iban : null;
}
