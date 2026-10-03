"use server";

import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { describeError } from "@/lib/errors";

import { auditInsert } from "../audit";
import { db } from "../db";
import { documents } from "../db/schema";
import { documentUploaded, inngest } from "../inngest/client";
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
    await markFailed({ documentId: doc.id, userId: user.id }, "queue_unavailable", detail);
  }

  revalidatePath("/", "layout");
}
