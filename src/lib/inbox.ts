/** A queued document that has not started for this long is offered a Retry. */
export const QUEUED_STALE_MS = 60_000;

/**
 * True when processing never started, e.g. the event reached an Inngest server
 * that is not connected to this app. Such documents get a Retry button.
 */
export function isStaleQueued(doc: { status: string; updatedAt: Date }, now = Date.now()): boolean {
  return doc.status === "received" && now - doc.updatedAt.getTime() > QUEUED_STALE_MS;
}
