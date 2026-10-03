import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "../db";
import { documents, tasks } from "../db/schema";

export type TaskFilter = "open" | "done" | "all";

export const taskFilters: TaskFilter[] = ["open", "done", "all"];

export function parseTaskFilter(value: unknown): TaskFilter {
  return taskFilters.includes(value as TaskFilter) ? (value as TaskFilter) : "open";
}

export async function listTasks(userId: string, filter: TaskFilter, limit?: number) {
  const query = db
    .select({
      id: tasks.id,
      kind: tasks.kind,
      title: tasks.title,
      dueDate: tasks.dueDate,
      amountCents: tasks.amountCents,
      status: tasks.status,
      completedAt: tasks.completedAt,
      sender: documents.sender,
    })
    .from(tasks)
    .leftJoin(documents, eq(documents.id, tasks.documentId))
    .where(and(eq(tasks.userId, userId), filter === "all" ? undefined : eq(tasks.status, filter)))
    .orderBy(
      // Open before done, then by deadline; most recently completed first among equals.
      asc(tasks.status),
      sql`${tasks.dueDate} asc nulls last`,
      desc(tasks.completedAt),
    );

  return limit ? query.limit(limit) : query;
}

export type TaskRow = Awaited<ReturnType<typeof listTasks>>[number];
