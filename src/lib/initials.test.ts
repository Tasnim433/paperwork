import { describe, expect, it } from "vitest";

import { firstName, initials } from "./initials";

describe("initials", () => {
  it("uses the first and last name", () => {
    expect(initials("Tasnim Amiri")).toBe("TA");
    expect(initials("  maria  de la  cruz ")).toBe("MC");
  });

  it("handles single names, umlauts and empty input", () => {
    expect(initials("lena")).toBe("L");
    expect(initials("Özlem Ünal")).toBe("ÖÜ");
    expect(initials("   ")).toBe("");
  });
});

describe("firstName", () => {
  it("returns the first word", () => {
    expect(firstName(" Tasnim Amiri ")).toBe("Tasnim");
  });
});
