/**
 * Reference formats. Known formats are strict; anything else must look like a
 * plausible reference (letters, digits and separators, at least one digit).
 */

export type ReferenceCheck = { normalized: string; rule: string | null };

const GENERIC = /^[A-Z0-9ÄÖÜ][A-Z0-9ÄÖÜ ./_-]{2,39}$/i;

/** German statutory health insurance number (Krankenversichertennummer): one letter, nine digits. */
export const HEALTH_INSURANCE_NUMBER = /^[A-Z]\d{9}$/;

/** Rundfunkbeitrag contribution number (Beitragsnummer): nine digits, often grouped by three. */
export const BROADCASTING_FEE_NUMBER = /^\d{9}$/;

export function checkReference(
  input: string,
  context: { sender?: string | null; fieldKey: string },
): ReferenceCheck {
  const normalized = input.trim().replace(/\s+/g, " ");
  const compact = normalized.replace(/[\s.-]/g, "").toUpperCase();
  const sender = context.sender?.toLowerCase() ?? "";

  if (sender.includes("beitragsservice") || sender.includes("rundfunk")) {
    return BROADCASTING_FEE_NUMBER.test(compact)
      ? {
          normalized: `${compact.slice(0, 3)} ${compact.slice(3, 6)} ${compact.slice(6)}`,
          rule: null,
        }
      : { normalized, rule: "reference.broadcastingFee" };
  }

  // Looks like a health insurance number (letter followed by digits, 10 characters).
  if (/^[A-Z]\d/i.test(compact) && compact.length === 10) {
    return HEALTH_INSURANCE_NUMBER.test(compact)
      ? { normalized: compact, rule: null }
      : { normalized, rule: "reference.healthInsurance" };
  }

  if (!GENERIC.test(normalized) || !/\d/.test(normalized)) {
    return { normalized, rule: "reference.format" };
  }
  return { normalized, rule: null };
}
