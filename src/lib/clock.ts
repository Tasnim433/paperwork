/**
 * The current time. On the server, FIXED_NOW (an ISO timestamp) pins it so that
 * screenshots and demos are reproducible; it is only set by `pnpm screenshots`
 * and must never be set in production. In the browser it is always the real time.
 */
export function now(): Date {
  const fixed = typeof process !== "undefined" ? process.env.FIXED_NOW : undefined;
  if (fixed) {
    const date = new Date(fixed);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}
