import { describe, expect, it } from "vitest";

import { confirmationMatches, parseReminderOffsets } from "./settings";

describe("parseReminderOffsets", () => {
  it("parses, de-duplicates and sorts offsets latest first", () => {
    expect(parseReminderOffsets("7, 3, 1")).toEqual([7, 3, 1]);
    expect(parseReminderOffsets("1 3 7 3")).toEqual([7, 3, 1]);
    expect(parseReminderOffsets("14;2")).toEqual([14, 2]);
    expect(parseReminderOffsets(" 5 ")).toEqual([5]);
  });

  it("rejects empty, non-numeric, out-of-range and too many values", () => {
    expect(parseReminderOffsets("")).toBeNull();
    expect(parseReminderOffsets("7, drei")).toBeNull();
    expect(parseReminderOffsets("0")).toBeNull();
    expect(parseReminderOffsets("61")).toBeNull();
    expect(parseReminderOffsets("1.5")).toBeNull();
    expect(parseReminderOffsets("1 2 3 4 5 6")).toBeNull();
  });
});

describe("confirmationMatches", () => {
  it("ignores case and surrounding spaces", () => {
    expect(confirmationMatches("  löschen ", "LÖSCHEN")).toBe(true);
    expect(confirmationMatches("Lena@Example.com", "lena@example.com")).toBe(true);
  });

  it("requires the exact word", () => {
    expect(confirmationMatches("LÖSCHE", "LÖSCHEN")).toBe(false);
    expect(confirmationMatches("", "")).toBe(false);
  });
});
