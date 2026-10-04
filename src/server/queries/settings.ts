import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../db";
import { auditLog, documents, tasks, type AuditActor } from "../db/schema";

export const auditActors: AuditActor[] = ["user", "ai", "system"];

export function parseActor(value: unknown): AuditActor | undefined {
  return auditActors.includes(value as AuditActor) ? (value as AuditActor) : undefined;
}

export const HISTORY_PAGE_SIZE = 50;

/**
 * Audit log entries of the user, newest first, with the name of the document or
 * task they refer to (when it still exists).
 */
export async function listHistory(userId: string, options: { actor?: AuditActor; limit: number }) {
  const rows = await db
    .select({
      id: auditLog.id,
      createdAt: auditLog.createdAt,
      actor: auditLog.actor,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      before: auditLog.before,
      after: auditLog.after,
      documentSender: documents.sender,
      documentFileName: documents.originalFileName,
      taskTitle: tasks.title,
    })
    .from(auditLog)
    .leftJoin(
      documents,
      and(eq(auditLog.entityType, "document"), sql`${documents.id}::text = ${auditLog.entityId}`),
    )
    .leftJoin(
      tasks,
      and(eq(auditLog.entityType, "task"), sql`${tasks.id}::text = ${auditLog.entityId}`),
    )
    .where(
      and(
        eq(auditLog.userId, userId),
        options.actor ? eq(auditLog.actor, options.actor) : undefined,
      ),
    )
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(options.limit + 1);

  return { entries: rows.slice(0, options.limit), hasMore: rows.length > options.limit };
}

export type HistoryEntry = Awaited<ReturnType<typeof listHistory>>["entries"][number];
