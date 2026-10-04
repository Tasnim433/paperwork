import { describe, expect, it } from "vitest";

import { documentHref } from "./documents";

describe("documentHref", () => {
  it("opens documents waiting for review in Review", () => {
    expect(documentHref({ id: "a", status: "needs_review" })).toBe("/inbox/a");
  });

  it("opens confirmed and information documents read-only", () => {
    expect(documentHref({ id: "a", status: "confirmed" })).toBe("/records/a");
    expect(documentHref({ id: "a", status: "information_only" })).toBe("/records/a");
  });

  it("sends documents still processing or failed to the Inbox", () => {
    expect(documentHref({ id: "a", status: "processing" })).toBe("/inbox");
    expect(documentHref({ id: "a", status: "failed" })).toBe("/inbox");
  });
});
