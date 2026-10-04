import { afterEach, describe, expect, it } from "vitest";

import { now } from "./clock";
import { timeOfDay, todayIso } from "./dates";

afterEach(() => {
  delete process.env.FIXED_NOW;
});

describe("clock", () => {
  it("uses the real time by default", () => {
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it("can be pinned with FIXED_NOW for reproducible screenshots", () => {
    process.env.FIXED_NOW = "2026-10-04T07:30:00Z";
    expect(now().toISOString()).toBe("2026-10-04T07:30:00.000Z");
    expect(todayIso()).toBe("2026-10-04");
    expect(timeOfDay()).toBe("morning");
  });

  it("ignores an invalid FIXED_NOW", () => {
    process.env.FIXED_NOW = "not a date";
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(1000);
  });
});
