"use server";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";

import { isLocale, type Locale } from "@/i18n/config";
import { berlinDateTime, todayIso } from "@/lib/dates";
import { describeError } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";
import {
  canConfirm,
  editedKeys,
  nextInQueue,
  plannedActions,
  validateReview,
  type PlannedAction,
  type StoredField,
} from "@/lib/review";
import { documentFields, documentTypes, type DocumentTypeKey } from "@/lib/schemas/document-fields";
import type { FieldResult } from "@/lib/validation/validate-document";

import { auditInsert } from "../audit";
import { db } from "../db";
import { documents, extractedFields, reminders, tasks, workEntries } from "../db/schema";
import { documentUploaded, inngest } from "../inngest/client";
import { queueErrorCode } from "../pipeline/errors";
import { markFailed } from "../pipeline/stages";
import { findDuplicate, reminderOffsets, reviewQueue } from "../queries/review";
import { requireSession } from "../session";

const reviewInput = z.object({
  documentId: z.uuid(),
  type: z.enum(documentTypes),
  values: z.record(z.string().max(64), z.string().max(1000)),
});

export type ReviewInput = z.infer<typeof reviewInput>;

export type ReviewActionResult =
  | { ok: true; next: string | null; created?: number }
  | { ok: false; error: "notReviewable" | "invalid" | "notConfirmable" | "queue" };

type Statement = Parameters<typeof db.batch>[0][number];

async function load(userId: string, documentId: string) {
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, documentId), eq(documents.userId, userId)),
  });
  if (!doc || doc.status !== "needs_review") return null;
  const rows = await db
    .select()
    .from(extractedFields)
    .where(eq(extractedFields.documentId, doc.id));
  return { doc, rows };
}

async function currentLocale(): Promise<Locale> {
  const locale = await getLocale();
  return isLocale(locale) ? locale : "de";
}

/**
 * Statements that write the reviewed fields: corrected values, new fields of a
 * changed type, removed fields of the old type, and an audit entry for each
 * correction with before/after values.
 */
function fieldStatements(
  userId: string,
  doc: { id: string; type: DocumentTypeKey | null; sender: string | null },
  rows: (typeof extractedFields.$inferSelect)[],
  type: DocumentTypeKey,
  results: FieldResult[],
  edited: string[],
): Statement[] {
  const statements: Statement[] = [];
  const rowByKey = new Map(rows.map((row) => [row.key, row]));
  const keys = new Set(documentFields[type].map((field) => field.key));

  if (doc.type !== type) {
    statements.push(
      db.update(documents).set({ type }).where(eq(documents.id, doc.id)),
      auditInsert({
        userId,
        actor: "user",
        action: "document.type_changed",
        entityType: "document",
        entityId: doc.id,
        before: { type: doc.type },
        after: { type },
      }),
    );
  }

  for (const result of results) {
    const row = rowByKey.get(result.key);
    const isEdited = edited.includes(result.key);
    if (row) {
      if (
        !isEdited &&
        row.state === result.state &&
        row.rule === result.rule &&
        row.value === result.value
      ) {
        continue;
      }
      statements.push(
        db
          .update(extractedFields)
          .set({
            value: result.value,
            state: result.state,
            rule: result.rule,
            ...(isEdited ? { editedByUser: true } : {}),
          })
          .where(eq(extractedFields.id, row.id)),
      );
      if (isEdited) {
        statements.push(
          auditInsert({
            userId,
            actor: "user",
            action: "field.corrected",
            entityType: "field",
            entityId: row.id,
            before: { documentId: doc.id, key: row.key, value: row.value, state: row.state },
            after: { documentId: doc.id, key: row.key, value: result.value, state: result.state },
          }),
        );
      }
    } else {
      const fieldId = randomUUID();
      statements.push(
        db.insert(extractedFields).values({
          id: fieldId,
          userId,
          documentId: doc.id,
          key: result.key,
          value: result.value,
          state: result.state,
          rule: result.rule,
          editedByUser: isEdited,
        }),
      );
      if (isEdited) {
        statements.push(
          auditInsert({
            userId,
            actor: "user",
            action: "field.corrected",
            entityType: "field",
            entityId: fieldId,
            before: { documentId: doc.id, key: result.key, value: null, state: null },
            after: {
              documentId: doc.id,
              key: result.key,
              value: result.value,
              state: result.state,
            },
          }),
        );
      }
    }
  }

  // Fields that belong to the previous type only.
  for (const row of rows.filter((row) => !keys.has(row.key))) {
    statements.push(
      db.delete(extractedFields).where(eq(extractedFields.id, row.id)),
      auditInsert({
        userId,
        actor: "user",
        action: "field.removed",
        entityType: "field",
        entityId: row.id,
        before: { documentId: doc.id, key: row.key, value: row.value, state: row.state },
        after: null,
      }),
    );
  }

  const sender = results.find((result) => result.key === "sender")?.value ?? null;
  if (sender !== doc.sender) {
    statements.push(db.update(documents).set({ sender }).where(eq(documents.id, doc.id)));
  }
  return statements;
}

async function prepare(input: ReviewInput) {
  const { user } = await requireSession();
  const parsed = reviewInput.safeParse(input);
  if (!parsed.success) return { error: "invalid" as const };
  const loaded = await load(user.id, parsed.data.documentId);
  if (!loaded) return { error: "notReviewable" as const };

  const locale = await currentLocale();
  const { type, values } = parsed.data;
  const stored: StoredField[] = loaded.rows.map((row) => ({
    key: row.key,
    value: row.value,
    confidence: row.confidence,
    located: row.sourcePage !== null,
  }));
  const results = validateReview(type, stored, values, locale);
  const edited = editedKeys(type, stored, values, locale);
  const statements = fieldStatements(user.id, loaded.doc, loaded.rows, type, results, edited);
  return { userId: user.id, locale, type, results, edited, statements, ...loaded };
}

/** Saves corrections without confirming. The document stays in the review queue. */
export async function saveDraft(input: ReviewInput): Promise<ReviewActionResult> {
  const prepared = await prepare(input);
  if ("error" in prepared) return { ok: false, error: prepared.error! };
  const { userId, doc, statements, edited } = prepared;

  await db.batch([
    auditInsert({
      userId,
      actor: "user",
      action: "document.draft_saved",
      entityType: "document",
      entityId: doc.id,
      after: { corrected: edited },
    }),
    ...statements,
  ]);
  revalidatePath("/", "layout");
  return { ok: true, next: null };
}

async function taskTitle(action: Extract<PlannedAction, { kind: "task" }>, locale: Locale) {
  const t = await getTranslations({ locale, namespace: "review.creates.titles" });
  const values = { ...action.values };
  if (action.amountCents !== null) values.amount = formatCurrency(action.amountCents, locale);
  return t(action.title, values);
}

/**
 * Confirms the document after re-checking every rule on the server, then creates
 * what the preview showed: tasks with reminders, work-day entries, the record.
 */
export async function confirmDocument(input: ReviewInput): Promise<ReviewActionResult> {
  const prepared = await prepare(input);
  if ("error" in prepared) return { ok: false, error: prepared.error! };
  const { userId, doc, type, results, statements, locale } = prepared;

  const values = Object.fromEntries(results.map((result) => [result.key, result.value]));
  const duplicate = await findDuplicate(userId, doc.id, type, values);
  if (!canConfirm(results, duplicate)) return { ok: false, error: "notConfirmable" };

  const queue = await reviewQueue(userId);
  const actions = plannedActions(type, results, {
    reminderOffsetDays: await reminderOffsets(userId),
    today: todayIso(),
  });

  const createdTasks: string[] = [];
  const createdWorkEntries: string[] = [];
  const createStatements: Statement[] = [];

  for (const action of actions) {
    if (action.kind === "task") {
      const taskId = randomUUID();
      createdTasks.push(taskId);
      const title = await taskTitle(action, locale);
      createStatements.push(
        db.insert(tasks).values({
          id: taskId,
          userId,
          documentId: doc.id,
          kind: action.taskKind,
          title,
          dueDate: action.dueDate,
          amountCents: action.amountCents,
        }),
        auditInsert({
          userId,
          actor: "system",
          action: "task.created",
          entityType: "task",
          entityId: taskId,
          after: { documentId: doc.id, kind: action.taskKind, title, dueDate: action.dueDate },
        }),
      );
      if (action.reminders.length > 0) {
        createStatements.push(
          db.insert(reminders).values(
            action.reminders.map((date) => ({
              userId,
              taskId,
              sendAt: berlinDateTime(date, "08:00"),
            })),
          ),
        );
      }
    } else if (action.kind === "workDays") {
      const entryId = randomUUID();
      createdWorkEntries.push(entryId);
      createStatements.push(
        db.insert(workEntries).values({
          id: entryId,
          userId,
          documentId: doc.id,
          month: `${action.month}-01`,
          fullDays: action.fullDays,
          halfDays: action.halfDays,
          hours: action.hours,
        }),
        auditInsert({
          userId,
          actor: "system",
          action: "work_entry.created",
          entityType: "work_entry",
          entityId: entryId,
          after: {
            documentId: doc.id,
            month: action.month,
            fullDays: action.fullDays,
            halfDays: action.halfDays,
          },
        }),
      );
    }
  }

  await db.batch([
    db
      .update(documents)
      .set({ status: "confirmed" })
      .where(and(eq(documents.id, doc.id), eq(documents.status, "needs_review"))),
    auditInsert({
      userId,
      actor: "user",
      action: "document.confirmed",
      entityType: "document",
      entityId: doc.id,
      before: { status: "needs_review", type: doc.type },
      after: {
        status: "confirmed",
        type,
        values,
        createdTasks,
        createdWorkEntries,
      },
    }),
    ...statements,
    ...createStatements,
  ]);

  revalidatePath("/", "layout");
  return { ok: true, next: nextInQueue(queue, doc.id), created: createdTasks.length };
}

/** Files the document as information only: corrections are kept, no tasks are created. */
export async function markInformationOnly(input: ReviewInput): Promise<ReviewActionResult> {
  const prepared = await prepare(input);
  if ("error" in prepared) return { ok: false, error: prepared.error! };
  const { userId, doc, statements } = prepared;
  const queue = await reviewQueue(userId);

  await db.batch([
    db.update(documents).set({ status: "information_only" }).where(eq(documents.id, doc.id)),
    auditInsert({
      userId,
      actor: "user",
      action: "document.filed_information_only",
      entityType: "document",
      entityId: doc.id,
      before: { status: "needs_review" },
      after: { status: "information_only" },
    }),
    ...statements,
  ]);
  revalidatePath("/", "layout");
  return { ok: true, next: nextInQueue(queue, doc.id) };
}

/** Runs the pipeline again. Extracted fields (including corrections) are replaced. */
export async function reprocessDocument(documentId: string): Promise<ReviewActionResult> {
  const { user } = await requireSession();
  const id = z.uuid().safeParse(documentId);
  if (!id.success) return { ok: false, error: "invalid" };
  const loaded = await load(user.id, id.data);
  if (!loaded) return { ok: false, error: "notReviewable" };
  const queue = await reviewQueue(user.id);

  await db.batch([
    db
      .update(documents)
      .set({ status: "received", processingStage: null, errorMessage: null, errorDetail: null })
      .where(eq(documents.id, loaded.doc.id)),
    auditInsert({
      userId: user.id,
      actor: "user",
      action: "document.reprocess_requested",
      entityType: "document",
      entityId: loaded.doc.id,
      before: {
        status: "needs_review",
        type: loaded.doc.type,
        fields: Object.fromEntries(loaded.rows.map((row) => [row.key, row.value])),
      },
      after: { status: "received" },
    }),
  ]);

  try {
    await inngest.send(
      documentUploaded.create(
        { documentId: loaded.doc.id, userId: user.id },
        { id: `reprocess-${loaded.doc.id}-${randomUUID()}` },
      ),
    );
  } catch (error) {
    const detail = describeError(error);
    console.error(`Could not queue document processing: ${detail}`);
    await markFailed({ documentId: loaded.doc.id, userId: user.id }, queueErrorCode(error), detail);
  }

  revalidatePath("/", "layout");
  return { ok: true, next: nextInQueue(queue, loaded.doc.id) };
}
