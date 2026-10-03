/**
 * How long a provider asks us to wait, from a Retry-After header or, for Gemini,
 * the RetryInfo "retryDelay" in the error body. Pure, so it can be unit tested.
 */
export function retryDelayMs(
  headers: Record<string, string> | undefined,
  body: string | undefined,
  now = Date.now(),
): number | null {
  const header = headers?.["retry-after"];
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(date - now, 0);
  }
  const match = body && /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body);
  if (match) return Math.round(Number(match[1]) * 1000);
  return null;
}

/** Waits longer than this mean a quota (e.g. a daily limit), not a short rate limit. */
export const QUOTA_THRESHOLD_MS = 15 * 60 * 1000;

export type ProviderBusy =
  { kind: "busy"; retryAfterMs: number | null } | { kind: "quota"; retryAfterMs: number };

/** Classifies a 429/503 response: a short wait (busy) or an exhausted quota. */
export function classifyBusy(
  statusCode: number | undefined,
  headers: Record<string, string> | undefined,
  body: string | undefined,
): ProviderBusy | null {
  if (statusCode !== 429 && statusCode !== 503) return null;
  const delay = retryDelayMs(headers, body);
  if (delay !== null && delay > QUOTA_THRESHOLD_MS) return { kind: "quota", retryAfterMs: delay };
  return { kind: "busy", retryAfterMs: delay };
}
