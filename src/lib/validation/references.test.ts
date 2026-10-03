import { describe, expect, it } from "vitest";

import { checkReference } from "./references";

const check = (value: string, sender: string | null = "Hausverwaltung Muster") =>
  checkReference(value, { sender, fieldKey: "reference" });

describe("checkReference", () => {
  it("accepts health insurance numbers (one letter, nine digits)", () => {
    expect(check("X123456789", "Musterkasse")).toEqual({ normalized: "X123456789", rule: null });
  });

  it("flags health-insurance-like numbers in the wrong format", () => {
    expect(check("X1234S6789", "Musterkasse").rule).toBe("reference.healthInsurance");
  });

  it("checks Rundfunkbeitrag numbers by sender and groups them", () => {
    expect(check("482113907", "Beitragsservice")).toEqual({
      normalized: "482 113 907",
      rule: null,
    });
    expect(check("482 113 907", "ARD ZDF Deutschlandradio Beitragsservice").rule).toBeNull();
    expect(check("48211390", "Beitragsservice").rule).toBe("reference.broadcastingFee");
  });

  it("accepts plausible generic references", () => {
    expect(check("NK-2025-17").rule).toBeNull();
    expect(check("AB-2026-04417").rule).toBeNull();
    expect(check("08/2026").rule).toBeNull();
  });

  it("rejects references without digits or with odd characters", () => {
    expect(check("siehe oben").rule).toBe("reference.format");
    expect(check("#?!").rule).toBe("reference.format");
    expect(check("12").rule).toBe("reference.format");
  });
});
