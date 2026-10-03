/** Up to two initials from a display name: "Tasnim Amiri" → "TA", "lena" → "L". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return (Array.from(first)[0] + (last ? Array.from(last)[0] : "")).toLocaleUpperCase();
}

/** First word of a display name, for greetings. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}
