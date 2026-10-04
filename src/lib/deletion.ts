/**
 * What deleting a document removes, and what remains of it in the audit log.
 * Pure so the rules are unit-tested; the server executes the plan in one batch.
 */

/** Documents not confirmed yet: can be discarded or get a replacement file. */
export const UNCONFIRMED_STATUSES = ["received", "processing", "needs_review", "failed"] as const;
/** Documents in Records: can be deleted. */
export const RECORD_STATUSES = ["confirmed", "information_only"] as const;

export type DeletionKind = "discard" | "record";

/** Whether a document in this status may be deleted in the given way. */
export function canDelete(status: string, kind: DeletionKind): boolean {
  const allowed: readonly string[] = kind === "discard" ? UNCONFIRMED_STATUSES : RECORD_STATUSES;
  return allowed.includes(status);
}

/** A new file can replace the old one while the document is not confirmed and not being processed. */
export function canReplaceFile(status: string): boolean {
  return status === "received" || status === "needs_review" || status === "failed";
}

/** Everything that belongs to one document, as loaded before deleting it. */
export type DocumentRelations = {
  documentId: string;
  storageKey: string | null;
  fieldIds: string[];
  pageCount: number;
  tasks: { id: string; status: "open" | "done"; reminderCount: number }[];
  workEntryIds: string[];
};

export type DeletionSummary = {
  documents: number;
  files: number;
  fields: number;
  pages: number;
  openTasks: number;
  completedTasks: number;
  reminders: number;
  workEntries: number;
};

/** Counts for the confirmation dialog: exactly what will be removed. */
export function deletionSummary(items: DocumentRelations[]): DeletionSummary {
  const summary: DeletionSummary = {
    documents: items.length,
    files: 0,
    fields: 0,
    pages: 0,
    openTasks: 0,
    completedTasks: 0,
    reminders: 0,
    workEntries: 0,
  };
  for (const item of items) {
    if (item.storageKey) summary.files += 1;
    summary.fields += item.fieldIds.length;
    summary.pages += item.pageCount;
    summary.workEntries += item.workEntryIds.length;
    for (const task of item.tasks) {
      if (task.status === "open") summary.openTasks += 1;
      else summary.completedTasks += 1;
      summary.reminders += task.reminderCount;
    }
  }
  return summary;
}

/**
 * IDs whose audit entries describe the deleted documents: the documents, their
 * fields, tasks and work entries. Their before/after values are removed.
 */
export function auditEntityIds(items: DocumentRelations[]): string[] {
  return [
    ...new Set(
      items.flatMap((item) => [
        item.documentId,
        ...item.fieldIds,
        ...item.tasks.map((task) => task.id),
        ...item.workEntryIds,
      ]),
    ),
  ];
}

type AuditValues = { before: unknown; after: unknown };

/** An audit entry about a deleted document keeps who/what/when, never content. */
export function scrubAuditEntry<T extends AuditValues>(entry: T): T {
  return { ...entry, before: null, after: null };
}

/** The neutral entry written for each deleted document. */
export function documentDeletedEntry(documentId: string) {
  return {
    actor: "user" as const,
    action: "document.deleted",
    entityType: "document" as const,
    entityId: documentId,
    before: null,
    after: null,
  };
}

/** Short form of a document ID for display ("Document 1a2b3c4d deleted by user"). */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

/** History retention in months; 0 keeps everything. */
export const RETENTION_OPTIONS = [3, 6, 12, 0] as const;
export type RetentionMonths = (typeof RETENTION_OPTIONS)[number];
export const DEFAULT_RETENTION_MONTHS: RetentionMonths = 12;

export function parseRetention(value: unknown): RetentionMonths | null {
  const number = Number(value);
  return (RETENTION_OPTIONS as readonly number[]).includes(number)
    ? (number as RetentionMonths)
    : null;
}

/** Entries created before this instant are removed; null keeps everything. */
export function retentionCutoff(months: number, now: Date): Date | null {
  if (months <= 0) return null;
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return cutoff;
}
