import "server-only";

import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";

import { isSameLetter, NOT_STATED_RULE, type StoredField } from "@/lib/review";
import { textMentionsDirectDebit } from "@/lib/task-rules";
import type { DocumentTypeKey } from "@/lib/schemas/document-fields";

import { db } from "../db";
import {
  documentPages,
  documents,
  extractedFields,
  tasks,
  userSettings,
  workEntries,
} from "../db/schema";

/** IDs of documents waiting for review, in Inbox order (newest first). */
export async function reviewQueue(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.status, "needs_review")))
    .orderBy(desc(documents.receivedDate), desc(documents.createdAt));
  return rows.map((row) => row.id);
}

async function fieldValues(documentIds: string[]) {
  if (documentIds.length === 0) return new Map<string, Record<string, string | null>>();
  const rows = await db
    .select({
      documentId: extractedFields.documentId,
      key: extractedFields.key,
      value: extractedFields.value,
    })
    .from(extractedFields)
    .where(inArray(extractedFields.documentId, documentIds));
  const byDocument = new Map<string, Record<string, string | null>>();
  for (const row of rows) {
    byDocument.set(row.documentId, { ...byDocument.get(row.documentId), [row.key]: row.value });
  }
  return byDocument;
}

/** Whether another document of the user is the same letter (see isSameLetter). */
export async function findDuplicate(
  userId: string,
  documentId: string,
  type: DocumentTypeKey | null,
  values: Record<string, string | null>,
): Promise<boolean> {
  if (!type || !values.sender) return false;
  const candidates = await db
    .select({ id: documents.id, type: documents.type })
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        ne(documents.id, documentId),
        eq(documents.type, type),
        inArray(documents.status, ["needs_review", "confirmed", "information_only"]),
      ),
    );
  const others = await fieldValues(candidates.map((candidate) => candidate.id));
  return candidates.some((candidate) =>
    isSameLetter(
      { type, values },
      { type: candidate.type, values: others.get(candidate.id) ?? {} },
    ),
  );
}

/** Whether the recognized text of the document mentions direct debit (see task rules). */
export async function documentMentionsDirectDebit(documentId: string): Promise<boolean> {
  const pages = await db
    .select({ text: documentPages.text })
    .from(documentPages)
    .where(eq(documentPages.documentId, documentId));
  return pages.some((page) => textMentionsDirectDebit(page.text));
}

export async function reminderOffsets(userId: string): Promise<number[]> {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
    columns: { reminderOffsetDays: true },
  });
  return settings?.reminderOffsetDays ?? [7, 3, 1];
}

/** Everything the Review screen needs, or null if the document is not the user's. */
export async function getReviewDocument(userId: string, documentId: string) {
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, documentId), eq(documents.userId, userId)),
  });
  if (!doc) return null;

  const [fieldRows, queue, offsets, directDebitInText] = await Promise.all([
    db
      .select()
      .from(extractedFields)
      .where(eq(extractedFields.documentId, doc.id))
      .orderBy(asc(extractedFields.createdAt)),
    reviewQueue(userId),
    reminderOffsets(userId),
    documentMentionsDirectDebit(doc.id),
  ]);

  const stored: StoredField[] = fieldRows.map((row) => ({
    key: row.key,
    value: row.value,
    confidence: row.confidence,
    located: row.sourcePage !== null,
    notStated: row.rule === NOT_STATED_RULE,
  }));
  const boxes = fieldRows
    .filter((row) => row.sourcePage !== null && row.boundingBox)
    .map((row) => ({ key: row.key, page: row.sourcePage!, box: row.boundingBox! }));

  const values = Object.fromEntries(fieldRows.map((row) => [row.key, row.value]));
  const duplicate = await findDuplicate(userId, doc.id, doc.type, values);

  const index = queue.indexOf(doc.id);
  return {
    document: {
      id: doc.id,
      status: doc.status,
      type: doc.type,
      sender: doc.sender,
      receivedDate: doc.receivedDate,
      originalFileName: doc.originalFileName,
      mimeType: doc.mimeType,
      summary: doc.summary,
      pageCount: doc.pageCount,
    },
    stored,
    boxes,
    duplicate,
    reminderOffsetDays: offsets,
    textMentionsDirectDebit: directDebitInText,
    queue: {
      position: index >= 0 ? index + 1 : null,
      total: queue.length,
      previous: index > 0 ? queue[index - 1] : null,
      next: index >= 0 && index < queue.length - 1 ? queue[index + 1] : null,
    },
  };
}

export type ReviewData = NonNullable<Awaited<ReturnType<typeof getReviewDocument>>>;

/** A document with its confirmed fields and what it created, for the read-only page. */
export async function getDocumentDetail(userId: string, documentId: string) {
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, documentId), eq(documents.userId, userId)),
  });
  if (!doc) return null;

  const [fieldRows, taskRows, workRows] = await Promise.all([
    db
      .select()
      .from(extractedFields)
      .where(eq(extractedFields.documentId, doc.id))
      .orderBy(asc(extractedFields.createdAt)),
    db
      .select({
        id: tasks.id,
        kind: tasks.kind,
        title: tasks.title,
        dueDate: tasks.dueDate,
        status: tasks.status,
        completionNote: tasks.completionNote,
      })
      .from(tasks)
      .where(and(eq(tasks.documentId, doc.id), eq(tasks.userId, userId)))
      .orderBy(asc(tasks.dueDate)),
    db
      .select({
        month: workEntries.month,
        fullDays: workEntries.fullDays,
        halfDays: workEntries.halfDays,
        source: workEntries.source,
      })
      .from(workEntries)
      .where(and(eq(workEntries.documentId, doc.id), eq(workEntries.userId, userId))),
  ]);

  return {
    document: {
      id: doc.id,
      status: doc.status,
      type: doc.type,
      sender: doc.sender,
      receivedDate: doc.receivedDate,
      originalFileName: doc.originalFileName,
      mimeType: doc.mimeType,
      summary: doc.summary,
    },
    fields: fieldRows.map((row) => ({ key: row.key, value: row.value, edited: row.editedByUser })),
    boxes: fieldRows
      .filter((row) => row.sourcePage !== null && row.boundingBox)
      .map((row) => ({ key: row.key, page: row.sourcePage!, box: row.boundingBox! })),
    tasks: taskRows,
    workEntries: workRows,
  };
}

export type DocumentDetail = NonNullable<Awaited<ReturnType<typeof getDocumentDetail>>>;
