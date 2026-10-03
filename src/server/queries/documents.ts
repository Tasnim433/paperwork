import "server-only";

import { and, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";

import { db } from "../db";
import { documentType, documents, extractedFields, tasks, type DocumentType } from "../db/schema";

const inboxStatuses = ["received", "processing", "needs_review", "failed"] as const;

/** Statuses during which the inbox keeps refreshing. */
export const activeStatuses = ["received", "processing"] as const;
const recordStatuses = ["confirmed", "information_only"] as const;

/** Documents that are new, processing, failed or waiting for review, newest first. */
export async function listInbox(userId: string) {
  const flagged = db
    .select({ documentId: extractedFields.documentId, count: count().as("flagged_count") })
    .from(extractedFields)
    .where(and(eq(extractedFields.userId, userId), ne(extractedFields.state, "valid")))
    .groupBy(extractedFields.documentId)
    .as("flagged");

  return db
    .select({
      id: documents.id,
      status: documents.status,
      processingStage: documents.processingStage,
      errorCode: documents.errorMessage,
      errorDetail: documents.errorDetail,
      type: documents.type,
      sender: documents.sender,
      originalFileName: documents.originalFileName,
      receivedDate: documents.receivedDate,
      flaggedCount: sql<number>`coalesce(${flagged.count}, 0)`.mapWith(Number),
    })
    .from(documents)
    .leftJoin(flagged, eq(flagged.documentId, documents.id))
    .where(and(eq(documents.userId, userId), inArray(documents.status, [...inboxStatuses])))
    .orderBy(desc(documents.receivedDate), desc(documents.createdAt));
}

export type InboxRow = Awaited<ReturnType<typeof listInbox>>[number];

export function parseDocumentType(value: unknown): DocumentType | undefined {
  return documentType.enumValues.includes(value as DocumentType)
    ? (value as DocumentType)
    : undefined;
}

/** Confirmed documents, filtered by type and a search over sender and reference. */
export async function listRecords(userId: string, filters: { type?: DocumentType; q?: string }) {
  const reference = db
    .select({ documentId: extractedFields.documentId, value: extractedFields.value })
    .from(extractedFields)
    .where(and(eq(extractedFields.userId, userId), eq(extractedFields.key, "reference")))
    .as("reference");

  const taskCounts = db
    .select({ documentId: tasks.documentId, count: count().as("task_count") })
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .groupBy(tasks.documentId)
    .as("task_counts");

  const q = filters.q?.trim();
  const pattern = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : undefined;

  return db
    .select({
      id: documents.id,
      type: documents.type,
      sender: documents.sender,
      receivedDate: documents.receivedDate,
      reference: reference.value,
      taskCount: sql<number>`coalesce(${taskCounts.count}, 0)`.mapWith(Number),
    })
    .from(documents)
    .leftJoin(reference, eq(reference.documentId, documents.id))
    .leftJoin(taskCounts, eq(taskCounts.documentId, documents.id))
    .where(
      and(
        eq(documents.userId, userId),
        inArray(documents.status, [...recordStatuses]),
        filters.type ? eq(documents.type, filters.type) : undefined,
        pattern ? or(ilike(documents.sender, pattern), ilike(reference.value, pattern)) : undefined,
      ),
    )
    .orderBy(desc(documents.receivedDate), desc(documents.createdAt));
}

export type RecordRow = Awaited<ReturnType<typeof listRecords>>[number];

/** Document types that occur among the user's records, in schema order. */
export async function listRecordTypes(userId: string): Promise<DocumentType[]> {
  const rows = await db
    .selectDistinct({ type: documents.type })
    .from(documents)
    .where(and(eq(documents.userId, userId), inArray(documents.status, [...recordStatuses])));
  const present = new Set(rows.map((row) => row.type));
  return documentType.enumValues.filter((type) => present.has(type));
}
