import { describe, expect, it } from "vitest";

import { describeError, isConnectionError } from "./errors";

describe("describeError", () => {
  it("unwraps fetch errors to the network cause", () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED ::1:8288"), {
      code: "ECONNREFUSED",
    });
    expect(describeError(new TypeError("fetch failed", { cause }))).toBe(
      "fetch failed: connect ECONNREFUSED ::1:8288",
    );
  });

  it("lists the errors of an AggregateError cause (IPv4 and IPv6 attempts)", () => {
    const cause = new AggregateError(
      [
        new Error("connect ECONNREFUSED ::1:8288"),
        new Error("connect ECONNREFUSED 127.0.0.1:8288"),
      ],
      "",
    );
    Object.assign(cause, { code: "ECONNREFUSED" });
    expect(describeError(new TypeError("fetch failed", { cause }))).toBe(
      "fetch failed: ECONNREFUSED: connect ECONNREFUSED ::1:8288; connect ECONNREFUSED 127.0.0.1:8288",
    );
  });

  it("does not repeat messages already contained in the outer one", () => {
    const inner = new Error("quota exceeded");
    expect(describeError(new Error("AI call failed: quota exceeded", { cause: inner }))).toBe(
      "AI call failed: quota exceeded",
    );
  });

  it("removes query strings from URLs", () => {
    expect(describeError(new Error("GET https://api.example.com/v1/x?key=secret failed"))).toBe(
      "GET https://api.example.com/v1/x failed",
    );
  });

  it("handles strings, empty values and cycles", () => {
    expect(describeError("plain text")).toBe("plain text");
    expect(describeError(undefined)).toBe("Unknown error");
    const loop = new Error("loop") as Error & { cause?: unknown };
    loop.cause = loop;
    expect(describeError(loop)).toBe("loop");
  });

  it("collapses line breaks into one line", () => {
    expect(describeError(new Error("Quota exceeded.\n* metric: requests\n  limit: 20"))).toBe(
      "Quota exceeded. * metric: requests limit: 20",
    );
  });

  it("truncates very long messages", () => {
    expect(describeError(new Error("x".repeat(1000)))).toHaveLength(400);
  });
});

describe("isConnectionError", () => {
  it("detects refused connections in the cause chain", () => {
    const refused = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:8288"), {
      code: "ECONNREFUSED",
    });
    expect(isConnectionError(new TypeError("fetch failed", { cause: refused }))).toBe(true);
    const aggregate = new AggregateError([refused], "");
    expect(isConnectionError(new TypeError("fetch failed", { cause: aggregate }))).toBe(true);
  });

  it("detects unknown hosts", () => {
    const notFound = Object.assign(new Error("getaddrinfo ENOTFOUND inngest.local"), {
      code: "ENOTFOUND",
    });
    expect(isConnectionError(new TypeError("fetch failed", { cause: notFound }))).toBe(true);
  });

  it("ignores error responses and plain errors", () => {
    expect(isConnectionError(new Error("401 Unauthorized: event key missing"))).toBe(false);
    expect(isConnectionError(undefined)).toBe(false);
  });
});
