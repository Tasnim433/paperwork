import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "../db";
import { documents, workEntries } from "../db/schema";

/** All work entries of the user with their source document, oldest month first. */
export async function listWorkEntries(userId: string) {
  return db
    .select({
      id: workEntries.id,
      month: workEntries.month,
      fullDays: workEntries.fullDays,
      halfDays: workEntries.halfDays,
      hours: workEntries.hours,
      source: workEntries.source,
      documentId: workEntries.documentId,
      documentStatus: documents.status,
      sender: documents.sender,
    })
    .from(workEntries)
    .leftJoin(documents, eq(documents.id, workEntries.documentId))
    .where(eq(workEntries.userId, userId))
    .orderBy(asc(workEntries.month), asc(workEntries.createdAt));
}

export type WorkEntryRow = Awaited<ReturnType<typeof listWorkEntries>>[number];
