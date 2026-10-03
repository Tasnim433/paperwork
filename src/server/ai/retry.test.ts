import { describe, expect, it } from "vitest";

import { classifyBusy, retryDelayMs } from "./retry";

const geminiQuotaBody = JSON.stringify({
  error: {
    code: 429,
    status: "RESOURCE_EXHAUSTED",
    details: [
      { "@type": "type.googleapis.com/google.rpc.QuotaFailure" },
      { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "8270s" },
    ],
  },
});

describe("retryDelayMs", () => {
  it("reads Retry-After in seconds or as a date", () => {
    expect(retryDelayMs({ "retry-after": "30" }, undefined)).toBe(30_000);
    const now = Date.parse("2026-10-03T12:00:00Z");
    expect(retryDelayMs({ "retry-after": "Sat, 03 Oct 2026 12:01:00 GMT" }, undefined, now)).toBe(
      60_000,
    );
  });

  it("reads Gemini's retryDelay from the error body", () => {
    expect(retryDelayMs(undefined, geminiQuotaBody)).toBe(8_270_000);
    expect(retryDelayMs({}, '{"retryDelay": "12.5s"}')).toBe(12_500);
  });

  it("returns null when no delay is given", () => {
    expect(retryDelayMs({}, '{"error":{"code":503}}')).toBeNull();
    expect(retryDelayMs(undefined, undefined)).toBeNull();
  });
});

describe("classifyBusy", () => {
  it("treats short waits and overloads as busy", () => {
    expect(classifyBusy(429, { "retry-after": "20" }, undefined)).toEqual({
      kind: "busy",
      retryAfterMs: 20_000,
    });
    expect(classifyBusy(503, undefined, "high demand")).toEqual({
      kind: "busy",
      retryAfterMs: null,
    });
  });

  it("treats long waits as an exhausted quota", () => {
    expect(classifyBusy(429, undefined, geminiQuotaBody)).toEqual({
      kind: "quota",
      retryAfterMs: 8_270_000,
    });
  });

  it("ignores other errors", () => {
    expect(classifyBusy(400, undefined, geminiQuotaBody)).toBeNull();
    expect(classifyBusy(undefined, undefined, undefined)).toBeNull();
  });
});
