import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../db";
import { DEFAULT_RETENTION_MONTHS } from "@/lib/deletion";

import { auditLog, documents, tasks, userSettings, type AuditActor } from "../db/schema";

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

/** History retention in months (0 = forever); the default when no settings exist. */
export async function historyRetention(userId: string): Promise<number> {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
    columns: { historyRetentionMonths: true },
  });
  return settings?.historyRetentionMonths ?? DEFAULT_RETENTION_MONTHS;
}
