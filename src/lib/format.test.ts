import { describe, expect, it } from "vitest";

import { formatDate } from "./format";

describe("formatDate", () => {
  const date = new Date("2026-10-03T10:00:00Z");

  it("uses German day.month.year format", () => {
    expect(formatDate(date, "de")).toBe("03.10.2026");
  });

  it("uses day/month/year format for English", () => {
    expect(formatDate(date, "en")).toBe("03/10/2026");
  });

  it("formats in the Europe/Berlin time zone", () => {
    expect(formatDate(new Date("2026-10-03T23:30:00Z"), "de")).toBe("04.10.2026");
  });
});
