"use server";

import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { deletionSummary, type DeletionKind, type DeletionSummary } from "@/lib/deletion";
import { describeError } from "@/lib/errors";

import { auditInsert } from "../audit";
import { db } from "../db";
import { deleteDocuments, loadRelations } from "../documents/deletion";
import { documents } from "../db/schema";
import { documentUploaded, inngest } from "../inngest/client";
import { queueErrorCode } from "../pipeline/errors";
import { markFailed } from "../pipeline/stages";
import { requireSession } from "../session";

/** Starts processing again for a failed document. */
export async function retryDocument(documentId: string) {
  const { user } = await requireSession();
  const id = z.uuid().safeParse(documentId);
  if (!id.success) return;

  const doc = await db.query.documents.findFirst({
    where: and(
      eq(documents.id, id.data),
      eq(documents.userId, user.id),
      inArray(documents.status, ["failed", "received"]),
    ),
    columns: { id: true, status: true, processingStage: true, errorMessage: true },
  });
  if (!doc) return;

  await db.batch([
    db
      .update(documents)
      .set({ status: "received", processingStage: null, errorMessage: null, errorDetail: null })
      .where(eq(documents.id, doc.id)),
    auditInsert({
      userId: user.id,
      actor: "user",
      action: "document.retry_requested",
      entityType: "document",
      entityId: doc.id,
      before: { status: doc.status, stage: doc.processingStage, error: doc.errorMessage },
      after: { status: "received" },
    }),
  ]);

  try {
    await inngest.send(
      documentUploaded.create(
        { documentId: doc.id, userId: user.id },
        { id: `retry-${doc.id}-${randomUUID()}` },
      ),
    );
  } catch (error) {
    const detail = describeError(error);
    console.error(`Could not queue document processing: ${detail}`);
    await markFailed({ documentId: doc.id, userId: user.id }, queueErrorCode(error), detail);
  }

  revalidatePath("/", "layout");
}

const idList = z.array(z.uuid()).min(1).max(100);

export type DeletionPreviewResult = { ok: true; summary: DeletionSummary } | { ok: false };

/** What deleting these documents would remove, for the confirmation dialog. */
export async function deletionPreview(
  ids: string[],
  kind: DeletionKind,
): Promise<DeletionPreviewResult> {
  const { user } = await requireSession();
  const parsed = idList.safeParse(ids);
  if (!parsed.success || (kind !== "discard" && kind !== "record")) return { ok: false };
  const relations = await loadRelations(user.id, parsed.data, kind);
  if (relations.length === 0) return { ok: false };
  return { ok: true, summary: deletionSummary(relations) };
}

export type DeleteDocumentsResult = { ok: true; deleted: number } | { ok: false };

/** Discards documents that are not confirmed yet (Inbox, Review). */
export async function discardDocuments(ids: string[]): Promise<DeleteDocumentsResult> {
  const { user } = await requireSession();
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return { ok: false };
  const { deleted } = await deleteDocuments(user.id, parsed.data, "discard");
  revalidatePath("/", "layout");
  return deleted > 0 ? { ok: true, deleted } : { ok: false };
}

/** Deletes confirmed documents from Records with everything created from them. */
export async function deleteRecordDocuments(ids: string[]): Promise<DeleteDocumentsResult> {
  const { user } = await requireSession();
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return { ok: false };
  const { deleted } = await deleteDocuments(user.id, parsed.data, "record");
  revalidatePath("/", "layout");
  return deleted > 0 ? { ok: true, deleted } : { ok: false };
}
