import { describe, expect, it } from "vitest";

import {
  auditEntityIds,
  canDelete,
  canReplaceFile,
  deletionSummary,
  documentDeletedEntry,
  parseRetention,
  retentionCutoff,
  scrubAuditEntry,
  shortId,
  type DocumentRelations,
} from "./deletion";

const invoice: DocumentRelations = {
  documentId: "doc-invoice",
  storageKey: "users/u/doc-invoice/original.pdf",
  fieldIds: ["f1", "f2", "f3"],
  pageCount: 1,
  tasks: [
    { id: "t-open", status: "open", reminderCount: 3 },
    { id: "t-done", status: "done", reminderCount: 2 },
  ],
  workEntryIds: [],
};

const payslip: DocumentRelations = {
  documentId: "doc-payslip",
  storageKey: "users/u/doc-payslip/original.pdf",
  fieldIds: ["f4"],
  pageCount: 2,
  tasks: [],
  workEntryIds: ["w1"],
};

describe("canDelete", () => {
  it("discards only documents that are not confirmed yet", () => {
    for (const status of ["received", "processing", "needs_review", "failed"]) {
      expect(canDelete(status, "discard")).toBe(true);
    }
    expect(canDelete("confirmed", "discard")).toBe(false);
    expect(canDelete("information_only", "discard")).toBe(false);
  });

  it("deletes only documents in Records", () => {
    expect(canDelete("confirmed", "record")).toBe(true);
    expect(canDelete("information_only", "record")).toBe(true);
    expect(canDelete("needs_review", "record")).toBe(false);
    expect(canDelete("processing", "record")).toBe(false);
  });
});

describe("canReplaceFile", () => {
  it("allows a new file before confirmation, but not while processing", () => {
    expect(canReplaceFile("needs_review")).toBe(true);
    expect(canReplaceFile("failed")).toBe(true);
    expect(canReplaceFile("received")).toBe(true);
    expect(canReplaceFile("processing")).toBe(false);
    expect(canReplaceFile("confirmed")).toBe(false);
  });
});

describe("deletionSummary", () => {
  it("counts file, fields, pages, open and completed tasks, reminders and work entries", () => {
    expect(deletionSummary([invoice, payslip])).toEqual({
      documents: 2,
      files: 2,
      fields: 4,
      pages: 3,
      openTasks: 1,
      completedTasks: 1,
      reminders: 5,
      workEntries: 1,
    });
  });

  it("counts a document without stored file or relations as just the document", () => {
    expect(
      deletionSummary([
        {
          documentId: "d",
          storageKey: null,
          fieldIds: [],
          pageCount: 0,
          tasks: [],
          workEntryIds: [],
        },
      ]),
    ).toEqual({
      documents: 1,
      files: 0,
      fields: 0,
      pages: 0,
      openTasks: 0,
      completedTasks: 0,
      reminders: 0,
      workEntries: 0,
    });
  });
});

describe("audit log", () => {
  it("scrubs entries of the document, its fields, tasks and work entries", () => {
    expect(auditEntityIds([invoice, payslip]).sort()).toEqual(
      ["doc-invoice", "doc-payslip", "f1", "f2", "f3", "f4", "t-done", "t-open", "w1"].sort(),
    );
  });

  it("removes before/after values but keeps who, what and when", () => {
    const entry = {
      id: "a1",
      actor: "user",
      action: "field.corrected",
      createdAt: "2026-10-04",
      before: { value: "DE12 3704 0044 0532 0130 00" },
      after: { value: "DE89370400440532013000" },
    };
    expect(scrubAuditEntry(entry)).toEqual({ ...entry, before: null, after: null });
  });

  it("adds one neutral entry without personal content", () => {
    expect(documentDeletedEntry("1a2b3c4d-0000-4000-8000-000000000000")).toEqual({
      actor: "user",
      action: "document.deleted",
      entityType: "document",
      entityId: "1a2b3c4d-0000-4000-8000-000000000000",
      before: null,
      after: null,
    });
    expect(shortId("1a2b3c4d-0000-4000-8000-000000000000")).toBe("1a2b3c4d");
  });
});

describe("history retention", () => {
  const now = new Date("2026-10-04T03:00:00Z");

  it("offers 3, 6 and 12 months and forever", () => {
    expect(parseRetention("3")).toBe(3);
    expect(parseRetention(12)).toBe(12);
    expect(parseRetention("0")).toBe(0);
    expect(parseRetention("24")).toBeNull();
    expect(parseRetention("abc")).toBeNull();
  });

  it("computes the cutoff in whole months, none for forever", () => {
    expect(retentionCutoff(3, now)?.toISOString()).toBe("2026-07-04T03:00:00.000Z");
    expect(retentionCutoff(12, now)?.toISOString()).toBe("2025-10-04T03:00:00.000Z");
    expect(retentionCutoff(0, now)).toBeNull();
  });
});
