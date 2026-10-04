/** Pure rules for user settings. */

export const MAX_REMINDER_OFFSETS = 5;
export const MAX_REMINDER_OFFSET_DAYS = 60;

/**
 * Parses reminder offsets typed as "7, 3, 1" (any separator). Returns unique whole
 * days between 1 and 60, latest first, or null when the input is not valid.
 */
export function parseReminderOffsets(input: string): number[] | null {
  const parts = input.split(/[\s,;]+/).filter(Boolean);
  if (parts.length === 0 || parts.length > MAX_REMINDER_OFFSETS) return null;
  if (!parts.every((part) => /^\d{1,2}$/.test(part))) return null;
  const days = [...new Set(parts.map(Number))];
  if (days.some((day) => day < 1 || day > MAX_REMINDER_OFFSET_DAYS)) return null;
  return days.sort((a, b) => b - a);
}

/** The word to type before deleting all documents, per language. */
export const DELETE_DOCUMENTS_WORD = { de: "LÖSCHEN", en: "DELETE" } as const;

/** Typed confirmations compare case-insensitively and ignore surrounding spaces. */
export function confirmationMatches(typed: string, expected: string): boolean {
  return (
    typed.trim().toLocaleLowerCase() === expected.trim().toLocaleLowerCase() &&
    expected.trim() !== ""
  );
}
