const MAX_DETAIL_LENGTH = 400;

/**
 * One-line description of an error including its causes, e.g.
 * "fetch failed: connect ECONNREFUSED ::1:8288". Node's fetch hides the real
 * reason in `cause` (sometimes an AggregateError), so the chain is unwrapped.
 * Query strings are removed from URLs so no credentials end up in the text.
 */
export function describeError(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && !seen.has(current) && parts.length < 5) {
    seen.add(current);
    const message = messageOf(current);
    if (message && !parts.some((part) => part.includes(message))) parts.push(message);
    const nested = (current as { errors?: unknown[] }).errors;
    if (Array.isArray(nested) && nested.length > 0) {
      const inner = [...new Set(nested.map(messageOf).filter(Boolean))].join("; ");
      if (inner && !parts.some((part) => part.includes(inner))) parts.push(inner);
    }
    current = (current as { cause?: unknown }).cause;
  }

  const text = (parts.join(": ") || "Unknown error")
    .replace(/\s+/g, " ")
    .replace(/(https?:\/\/[^\s?"']+)\?[^\s"']*/g, "$1");
  return text.length > MAX_DETAIL_LENGTH ? `${text.slice(0, MAX_DETAIL_LENGTH - 1)}…` : text;
}

function messageOf(error: unknown): string {
  if (typeof error === "string") return error.trim();
  if (!error || typeof error !== "object") return "";
  const { message, code } = error as { message?: unknown; code?: unknown };
  const text = typeof message === "string" ? message.trim() : "";
  // Some network errors only carry a code (e.g. ECONNREFUSED with an empty message).
  if (!text && typeof code === "string") return code;
  return text;
}

const CONNECTION_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

/**
 * True when the error means the other side could not be reached at all (nothing
 * listening, unknown host, connection reset), as opposed to an error response.
 */
export function isConnectionError(error: unknown): boolean {
  const seen = new Set<unknown>();
  const queue: unknown[] = [error];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    const { code, cause, errors } = current as {
      code?: unknown;
      cause?: unknown;
      errors?: unknown;
    };
    if (typeof code === "string" && CONNECTION_CODES.has(code)) return true;
    queue.push(cause);
    if (Array.isArray(errors)) queue.push(...errors);
  }
  return false;
}
