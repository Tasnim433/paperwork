"use server";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { validateManualEntry, type ManualEntryError } from "@/lib/work-days";

import { auditInsert } from "../audit";
import { db } from "../db";
import { documents, workEntries } from "../db/schema";
import { requireSession } from "../session";

const input = z.object({
  documentId: z.uuid(),
  month: z.string().max(7),
  fullDays: z.number(),
  halfDays: z.number(),
});

export type ManualWorkDaysResult =
  { ok: true } | { ok: false; error: "notAllowed" | "exists" | ManualEntryError };

/**
 * Stores work days the user typed in for a confirmed payslip that did not state
 * them. The entry is marked as source "manual" and written to the audit log.
 */
export async function addManualWorkEntry(
  raw: z.input<typeof input>,
): Promise<ManualWorkDaysResult> {
  const { user } = await requireSession();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "notAllowed" };
  const { documentId, month, fullDays, halfDays } = parsed.data;

  const errors = validateManualEntry({ month, fullDays, halfDays });
  if (errors.length > 0) return { ok: false, error: errors[0] };

  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, documentId), eq(documents.userId, user.id)),
    columns: { id: true, type: true, status: true },
  });
  if (!doc || doc.type !== "payslip" || doc.status !== "confirmed")
    return { ok: false, error: "notAllowed" };

  const existing = await db.query.workEntries.findFirst({
    where: and(eq(workEntries.documentId, doc.id), eq(workEntries.userId, user.id)),
    columns: { id: true },
  });
  if (existing) return { ok: false, error: "exists" };

  const entryId = randomUUID();
  const entry = { month: `${month}-01`, fullDays, halfDays, source: "manual" as const };
  await db.batch([
    db.insert(workEntries).values({ id: entryId, userId: user.id, documentId: doc.id, ...entry }),
    auditInsert({
      userId: user.id,
      actor: "user",
      action: "work_entry.created_manually",
      entityType: "work_entry",
      entityId: entryId,
      before: null,
      after: { documentId: doc.id, ...entry, month },
    }),
  ]);

  revalidatePath("/", "layout");
  return { ok: true };
}
