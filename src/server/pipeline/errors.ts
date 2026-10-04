import { NonRetriableError, RetryAfterError } from "inngest";

import { isConnectionError } from "@/lib/errors";

import { providerBusy } from "../ai";
import { UnreadableDocumentError } from "./text-extraction";

/** Error codes stored on failed documents and translated in the UI. */
export type PipelineErrorCode =
  | "unreadable"
  | "rate_limited"
  | "quota_exhausted"
  | "not_found"
  | "queue_unavailable"
  | "queue_not_running"
  | "unknown";

/** Backoff when the AI provider is busy and sends no Retry-After: 20 s, 40 s, 80 s … max 5 min. */
export function backoffMs(attempt: number): number {
  return Math.min(20_000 * 2 ** attempt, 300_000);
}

/**
 * Runs an AI call. When the provider is busy (429/503 with a short or no wait),
 * throws a RetryAfterError so Inngest waits before retrying the step. When a
 * quota is exhausted (e.g. a daily limit), retrying soon is pointless: fail now.
 */
export async function withRateLimitRetry<T>(attempt: number, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const busy = providerBusy(error);
    if (busy?.kind === "quota") {
      throw new NonRetriableError("AI quota exhausted", { cause: error });
    }
    if (busy) {
      throw new RetryAfterError("AI provider busy", busy.retryAfterMs ?? backoffMs(attempt), {
        cause: error,
      });
    }
    throw error;
  }
}

/** Errors that will not go away on retry. */
export function nonRetriable(error: unknown): never {
  if (error instanceof UnreadableDocumentError) {
    throw new NonRetriableError(error.message, { cause: error });
  }
  throw error;
}

/** Maps a failure to a user-safe code. Details stay in the Inngest run log. */
export function errorCode(error: unknown): PipelineErrorCode {
  const text = `${(error as Error)?.name ?? ""} ${(error as Error)?.message ?? ""}`;
  if (/Unreadable|Unsupported file type|no pages|Invalid PDF/i.test(text)) return "unreadable";
  if (/quota exhausted/i.test(text)) return "quota_exhausted";
  if (/provider busy|rate limit|overload|429|503|high demand/i.test(text)) return "rate_limited";
  if (/Document not found/i.test(text)) return "not_found";
  return "unknown";
}

/**
 * Why an event could not be sent to Inngest: nothing reachable (locally: the
 * dev server is not running) or another error (e.g. a missing event key).
 */
export function queueErrorCode(error: unknown): PipelineErrorCode {
  return isConnectionError(error) ? "queue_not_running" : "queue_unavailable";
}
