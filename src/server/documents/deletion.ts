import "server-only";

import { and, count, eq, inArray, or, sql } from "drizzle-orm";

import {
  auditEntityIds,
  canDelete,
  deletionSummary,
  documentDeletedEntry,
  type DeletionKind,
  type DocumentRelations,
} from "@/lib/deletion";
import { describeError } from "@/lib/errors";

import { auditInsert } from "../audit";
import { db } from "../db";
import {
  auditLog,
  documentPages,
  documents,
  extractedFields,
  reminders,
  tasks,
  workEntries,
} from "../db/schema";
import { storage } from "../storage";

const MAX_DOCUMENTS = 100;

/**
 * Loads the user's documents among `ids` that may be deleted in this way, with
 * everything that belongs to them. Other users' documents are never returned.
 */
export async function loadRelations(
  userId: string,
  ids: string[],
  kind: DeletionKind,
): Promise<DocumentRelations[]> {
  const unique = [...new Set(ids)].slice(0, MAX_DOCUMENTS);
  if (unique.length === 0) return [];

  const docs = await db
    .select({ id: documents.id, status: documents.status, storageKey: documents.storageKey })
    .from(documents)
    .where(and(eq(documents.userId, userId), inArray(documents.id, unique)));
  const allowed = docs.filter((doc) => canDelete(doc.status, kind));
  if (allowed.length === 0) return [];
  const docIds = allowed.map((doc) => doc.id);

  const [fieldRows, pageRows, taskRows, workRows] = await Promise.all([
    db
      .select({ id: extractedFields.id, documentId: extractedFields.documentId })
      .from(extractedFields)
      .where(and(eq(extractedFields.userId, userId), inArray(extractedFields.documentId, docIds))),
    db
      .select({ documentId: documentPages.documentId, pages: count() })
      .from(documentPages)
      .where(and(eq(documentPages.userId, userId), inArray(documentPages.documentId, docIds)))
      .groupBy(documentPages.documentId),
    db
      .select({
        id: tasks.id,
        documentId: tasks.documentId,
        status: tasks.status,
      })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), inArray(tasks.documentId, docIds))),
    db
      .select({ id: workEntries.id, documentId: workEntries.documentId })
      .from(workEntries)
      .where(and(eq(workEntries.userId, userId), inArray(workEntries.documentId, docIds))),
  ]);

  // Counted separately: a correlated subquery would lose the table name of tasks.id.
  const taskIds = taskRows.map((row) => row.id);
  const reminderRows = taskIds.length
    ? await db
        .select({ taskId: reminders.taskId, count: count() })
        .from(reminders)
        .where(and(eq(reminders.userId, userId), inArray(reminders.taskId, taskIds)))
        .groupBy(reminders.taskId)
    : [];
  const remindersOf = (taskId: string) =>
    reminderRows.find((row) => row.taskId === taskId)?.count ?? 0;

  return allowed.map((doc) => ({
    documentId: doc.id,
    storageKey: doc.storageKey,
    fieldIds: fieldRows.filter((row) => row.documentId === doc.id).map((row) => row.id),
    pageCount: pageRows.find((row) => row.documentId === doc.id)?.pages ?? 0,
    tasks: taskRows
      .filter((row) => row.documentId === doc.id)
      .map((row) => ({ id: row.id, status: row.status, reminderCount: remindersOf(row.id) })),
    workEntryIds: workRows.filter((row) => row.documentId === doc.id).map((row) => row.id),
  }));
}

/** Removes stored files; failures are logged (the database rows are already gone). */
export async function deleteStoredFiles(keys: string[]) {
  const results = await Promise.allSettled(keys.map((key) => storage().delete(key)));
  const failed = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failed.length > 0) {
    console.error(
      `Could not delete ${failed.length} stored file(s): ${describeError(failed[0].reason)}`,
    );
  }
}

/**
 * Deletes the user's documents completely: fields, pages, tasks with reminders,
 * work entries and the stored originals. Their audit entries lose all values;
 * one neutral "document deleted" entry is added per document.
 */
export async function deleteDocuments(userId: string, ids: string[], kind: DeletionKind) {
  const relations = await loadRelations(userId, ids, kind);
  if (relations.length === 0) return { deleted: 0, summary: deletionSummary([]) };

  const docIds = relations.map((item) => item.documentId);
  const scrubIds = auditEntityIds(relations);

  await db.batch([
    // Audit entries about these documents keep who/what/when, never content.
    db
      .update(auditLog)
      .set({ before: null, after: null })
      .where(
        and(
          eq(auditLog.userId, userId),
          or(
            inArray(auditLog.entityId, scrubIds),
            inArray(sql`${auditLog.after} ->> 'documentId'`, docIds),
            inArray(sql`${auditLog.before} ->> 'documentId'`, docIds),
          ),
        ),
      ),
    // Work entries keep a nullable link to the document, so they are removed explicitly.
    db
      .delete(workEntries)
      .where(and(eq(workEntries.userId, userId), inArray(workEntries.documentId, docIds))),
    // Reminders cascade from their task.
    db.delete(tasks).where(and(eq(tasks.userId, userId), inArray(tasks.documentId, docIds))),
    // Fields and pages cascade from the document.
    db.delete(documents).where(and(eq(documents.userId, userId), inArray(documents.id, docIds))),
    ...docIds.map((id) => auditInsert({ userId, ...documentDeletedEntry(id) })),
  ]);

  await deleteStoredFiles(relations.flatMap((item) => (item.storageKey ? [item.storageKey] : [])));
  return { deleted: docIds.length, summary: deletionSummary(relations) };
}
