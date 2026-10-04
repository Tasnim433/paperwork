"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { MAX_TASK_NOTE_LENGTH } from "@/lib/task-rules";

import { auditInsert } from "../audit";
import { db } from "../db";
import { tasks } from "../db/schema";
import { requireSession } from "../session";

const input = z.object({
  taskId: z.uuid(),
  note: z
    .string()
    .max(MAX_TASK_NOTE_LENGTH)
    .optional()
    .transform((value) => value?.trim() || null),
});

/**
 * Marks one of the user's open tasks as done, with an optional note (e.g. "paid
 * on 12.10."), and records it in the audit log.
 */
export async function markTaskDone(taskId: string, note?: string): Promise<{ ok: boolean }> {
  const { user } = await requireSession();
  const parsed = input.safeParse({ taskId, note });
  if (!parsed.success) return { ok: false };

  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, parsed.data.taskId), eq(tasks.userId, user.id)),
    columns: { id: true, status: true, completedAt: true },
  });
  if (!task || task.status === "done") return { ok: false };

  const completedAt = new Date();
  await db.batch([
    db
      .update(tasks)
      .set({ status: "done", completedAt, completionNote: parsed.data.note })
      .where(and(eq(tasks.id, task.id), eq(tasks.userId, user.id), eq(tasks.status, "open"))),
    auditInsert({
      userId: user.id,
      actor: "user",
      action: "task.completed",
      entityType: "task",
      entityId: task.id,
      before: { status: task.status, completedAt: task.completedAt },
      after: { status: "done", completedAt: completedAt.toISOString(), note: parsed.data.note },
    }),
  ]);

  revalidatePath("/", "layout");
  return { ok: true };
}
