"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auditInsert } from "../audit";
import { db } from "../db";
import { tasks } from "../db/schema";
import { requireSession } from "../session";

/** Marks one of the user's open tasks as done and records it in the audit log. */
export async function markTaskDone(taskId: string) {
  const { user } = await requireSession();
  const id = z.uuid().safeParse(taskId);
  if (!id.success) return;

  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, id.data), eq(tasks.userId, user.id)),
    columns: { id: true, status: true, completedAt: true },
  });
  if (!task || task.status === "done") return;

  const completedAt = new Date();
  await db.batch([
    db
      .update(tasks)
      .set({ status: "done", completedAt })
      .where(and(eq(tasks.id, task.id), eq(tasks.userId, user.id), eq(tasks.status, "open"))),
    auditInsert({
      userId: user.id,
      actor: "user",
      action: "task.completed",
      entityType: "task",
      entityId: task.id,
      before: { status: task.status, completedAt: task.completedAt },
      after: { status: "done", completedAt: completedAt.toISOString() },
    }),
  ]);

  revalidatePath("/", "layout");
}
