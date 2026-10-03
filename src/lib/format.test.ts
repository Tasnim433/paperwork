import { describe, expect, it } from "vitest";

import { formatCurrency, formatDate, formatDateTime } from "./format";

const nbsp = " ";

describe("formatDate", () => {
  it("formats calendar dates in German style", () => {
    expect(formatDate("2026-11-15", "de")).toBe("15.11.2026");
  });

  it("formats calendar dates in English style", () => {
    expect(formatDate("2026-11-15", "en")).toBe("15 Nov 2026");
  });

  it("never shifts a calendar date across the day boundary", () => {
    expect(formatDate("2026-03-29", "de")).toBe("29.03.2026");
    expect(formatDate("2026-12-31", "de")).toBe("31.12.2026");
  });

  it("shows points in time in the Europe/Berlin time zone", () => {
    expect(formatDate(new Date("2026-10-03T23:30:00Z"), "de")).toBe("04.10.2026");
  });
});

describe("formatDateTime", () => {
  it("includes the German local time", () => {
    expect(formatDateTime(new Date("2026-10-02T16:04:00Z"), "de")).toBe("02.10.2026, 18:04");
  });
});

describe("formatCurrency", () => {
  it("formats euro cents in German style", () => {
    expect(formatCurrency(13248, "de")).toBe(`132,48${nbsp}€`);
    expect(formatCurrency(123456, "de")).toBe(`1.234,56${nbsp}€`);
  });

  it("formats euro cents in English style", () => {
    expect(formatCurrency(5508, "en")).toBe("€55.08");
  });
});
