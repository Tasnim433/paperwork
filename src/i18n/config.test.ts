import { describe, expect, it } from "vitest";

import { matchAcceptLanguage } from "./config";

describe("matchAcceptLanguage", () => {
  it("returns undefined without a header", () => {
    expect(matchAcceptLanguage(null)).toBeUndefined();
  });

  it("picks the highest-ranked supported language", () => {
    expect(matchAcceptLanguage("fr-FR,fr;q=0.9,en-US;q=0.8,de;q=0.7")).toBe("en");
  });

  it("ignores unsupported languages", () => {
    expect(matchAcceptLanguage("fr,es;q=0.5")).toBeUndefined();
  });
});
