import { describe, expect, it } from "vitest";

import { documentHref, needsManualWorkDays } from "./documents";

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

describe("needsManualWorkDays", () => {
  it("is true for confirmed payslips without a work entry", () => {
    expect(needsManualWorkDays({ type: "payslip", status: "confirmed", workEntryCount: 0 })).toBe(
      true,
    );
  });

  it("is false once days exist, for other types and before confirmation", () => {
    expect(needsManualWorkDays({ type: "payslip", status: "confirmed", workEntryCount: 1 })).toBe(
      false,
    );
    expect(needsManualWorkDays({ type: "invoice", status: "confirmed", workEntryCount: 0 })).toBe(
      false,
    );
    expect(
      needsManualWorkDays({ type: "payslip", status: "needs_review", workEntryCount: 0 }),
    ).toBe(false);
  });
});
