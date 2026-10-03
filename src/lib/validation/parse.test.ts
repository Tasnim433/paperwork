import { describe, expect, it } from "vitest";

import {
  centsToDecimal,
  parseAmountCents,
  parseDate,
  parseIban,
  parseInteger,
  parseMonth,
  parseNumber,
  parseTime,
} from "./parse";

describe("parseDate", () => {
  it("parses ISO dates", () => {
    expect(parseDate("2026-11-15")).toBe("2026-11-15");
  });

  it("parses German numeric dates", () => {
    expect(parseDate("15.11.2026")).toBe("2026-11-15");
    expect(parseDate("1.2.2026")).toBe("2026-02-01");
    expect(parseDate("15.11.26")).toBe("2026-11-15");
    expect(parseDate(" 15. 11. 2026 ")).toBe("2026-11-15");
  });

  it("parses German written months, full and abbreviated", () => {
    expect(parseDate("15. November 2026")).toBe("2026-11-15");
    expect(parseDate("3. März 2026")).toBe("2026-03-03");
    expect(parseDate("3. Maerz 2026")).toBe("2026-03-03");
    expect(parseDate("1. Okt. 2026")).toBe("2026-10-01");
    expect(parseDate("24. Dez 2026")).toBe("2026-12-24");
  });

  it("parses English written months", () => {
    expect(parseDate("15 November 2026")).toBe("2026-11-15");
    expect(parseDate("November 15, 2026")).toBe("2026-11-15");
    expect(parseDate("15 Oct 2026")).toBe("2026-10-15");
  });

  it("rejects impossible or unsupported dates", () => {
    expect(parseDate("31.02.2026")).toBeNull();
    expect(parseDate("29.02.2027")).toBeNull();
    expect(parseDate("29.02.2028")).toBe("2028-02-29");
    expect(parseDate("15.13.2026")).toBeNull();
    expect(parseDate("2026-11-31")).toBeNull();
    expect(parseDate("15. Brumaire 2026")).toBeNull();
    expect(parseDate("11/15/2026")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("parseTime", () => {
  it("normalizes common notations to HH:MM", () => {
    expect(parseTime("09:30")).toBe("09:30");
    expect(parseTime("9:30")).toBe("09:30");
    expect(parseTime("9.30 Uhr")).toBe("09:30");
    expect(parseTime("14 Uhr")).toBe("14:00");
  });

  it("rejects OCR errors and impossible times", () => {
    expect(parseTime("09:3O")).toBeNull();
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("12:60")).toBeNull();
  });
});

describe("parseMonth", () => {
  it("normalizes months to YYYY-MM", () => {
    expect(parseMonth("09/2026")).toBe("2026-09");
    expect(parseMonth("9.2026")).toBe("2026-09");
    expect(parseMonth("2026-09")).toBe("2026-09");
    expect(parseMonth("September 2026")).toBe("2026-09");
    expect(parseMonth("Sep 26")).toBe("2026-09");
  });

  it("rejects invalid months", () => {
    expect(parseMonth("13/2026")).toBeNull();
    expect(parseMonth("Herbst 2026")).toBeNull();
  });
});

describe("parseAmountCents", () => {
  it("parses German notation", () => {
    expect(parseAmountCents("132,48 €")).toBe(13248);
    expect(parseAmountCents("1.234,56 €")).toBe(123456);
    expect(parseAmountCents("EUR 55,08")).toBe(5508);
    expect(parseAmountCents("88,-")).toBe(8800);
    expect(parseAmountCents("1.234")).toBe(123400);
  });

  it("parses English notation", () => {
    expect(parseAmountCents("€132.48")).toBe(13248);
    expect(parseAmountCents("1,234.56")).toBe(123456);
    expect(parseAmountCents("88")).toBe(8800);
    expect(parseAmountCents("12.5")).toBe(1250);
  });

  it("keeps the sign of negative amounts", () => {
    expect(parseAmountCents("-12,50 €")).toBe(-1250);
  });

  it("rejects malformed amounts", () => {
    expect(parseAmountCents("12,345,67")).toBeNull();
    expect(parseAmountCents("1.23.45")).toBeNull();
    expect(parseAmountCents("12.3456")).toBeNull();
    expect(parseAmountCents("abc")).toBeNull();
    expect(parseAmountCents("")).toBeNull();
    expect(parseAmountCents("1,234,56.7.8")).toBeNull();
  });

  it("formats cents back to a decimal string", () => {
    expect(centsToDecimal(13248)).toBe("132.48");
    expect(centsToDecimal(5)).toBe("0.05");
    expect(centsToDecimal(-1250)).toBe("-12.50");
  });
});

describe("parseIban", () => {
  it("accepts valid IBANs with or without spaces", () => {
    expect(parseIban("DE89 3704 0044 0532 0130 00")).toBe("DE89370400440532013000");
    expect(parseIban("de89370400440532013000")).toBe("DE89370400440532013000");
    expect(parseIban("GB82 WEST 1234 5698 7654 32")).toBe("GB82WEST12345698765432");
  });

  it("rejects wrong checksums and lengths", () => {
    expect(parseIban("DE89 3704 0044 0532 0130 01")).toBeNull();
    expect(parseIban("DE89 3704 0044 0532 0130")).toBeNull();
    expect(parseIban("not an iban")).toBeNull();
  });
});

describe("parseInteger / parseNumber", () => {
  it("parses whole numbers", () => {
    expect(parseInteger("11")).toBe(11);
    expect(parseInteger("1.5")).toBeNull();
    expect(parseInteger("-3")).toBeNull();
  });

  it("parses decimals with comma or dot", () => {
    expect(parseNumber("64,5")).toBe(64.5);
    expect(parseNumber("64.0")).toBe(64);
    expect(parseNumber("abc")).toBeNull();
  });
});
