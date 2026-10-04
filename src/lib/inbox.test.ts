import { describe, expect, it } from "vitest";

import { isStaleQueued, QUEUED_STALE_MS } from "./inbox";

describe("isStaleQueued", () => {
  const now = Date.parse("2026-10-04T10:00:00Z");
  const at = (msAgo: number) => new Date(now - msAgo);

  it("is false for freshly queued documents", () => {
    expect(isStaleQueued({ status: "received", updatedAt: at(5_000) }, now)).toBe(false);
    expect(isStaleQueued({ status: "received", updatedAt: at(QUEUED_STALE_MS) }, now)).toBe(false);
  });

  it("is true for documents queued longer than the limit", () => {
    expect(isStaleQueued({ status: "received", updatedAt: at(QUEUED_STALE_MS + 1) }, now)).toBe(
      true,
    );
  });

  it("only applies to queued documents", () => {
    expect(isStaleQueued({ status: "processing", updatedAt: at(600_000) }, now)).toBe(false);
    expect(isStaleQueued({ status: "failed", updatedAt: at(600_000) }, now)).toBe(false);
  });
});
