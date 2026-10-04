import { createHash, randomUUID } from "node:crypto";

import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";

import { canReplaceFile } from "@/lib/deletion";
import { describeError } from "@/lib/errors";
import { detectFileType, MAX_UPLOAD_BYTES } from "@/lib/files";
import { auditInsert } from "@/server/audit";
import { db } from "@/server/db";
import { documentPages, documents, extractedFields } from "@/server/db/schema";
import { deleteStoredFiles } from "@/server/documents/deletion";
import { documentUploaded, inngest } from "@/server/inngest/client";
import { queueErrorCode } from "@/server/pipeline/errors";
import { markFailed } from "@/server/pipeline/stages";
import { getSession } from "@/server/session";
import { replacementKey, storage } from "@/server/storage";

import type { UploadResponse } from "../../route";

const fail = (
  status: number,
  body: Extract<UploadResponse, { ok: false }> | { ok: false; error: "notAllowed" },
) => NextResponse.json(body, { status });

/**
 * Replaces the file of a document that is not confirmed yet: stores the new
 * original under a new key, resets everything extracted from the old one,
 * deletes the old file and runs the pipeline again.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/documents/[id]/replace">,
) {
  const session = await getSession();
  if (!session) return fail(401, { ok: false, error: "unauthorized" });
  const userId = session.user.id;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, { ok: false, error: "notAllowed" });

  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, id), eq(documents.userId, userId)),
    columns: { id: true, status: true, storageKey: true, originalFileName: true, sha256: true },
  });
  // Not while processing: a running pipeline step could mix the old and the new file.
  if (!doc || !canReplaceFile(doc.status)) return fail(403, { ok: false, error: "notAllowed" });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail(400, { ok: false, error: "noFile" });
  if (file.size === 0) return fail(400, { ok: false, error: "empty" });
  if (file.size > MAX_UPLOAD_BYTES) return fail(413, { ok: false, error: "tooLarge" });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectFileType(bytes);
  if (!type) return fail(415, { ok: false, error: "unsupportedType" });

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const duplicate = await db.query.documents.findFirst({
    where: and(
      eq(documents.userId, userId),
      eq(documents.sha256, sha256),
      ne(documents.id, doc.id),
    ),
    columns: { receivedDate: true },
  });
  if (duplicate) return fail(409, { ok: false, error: "duplicate", existing: duplicate });

  const fileName = (file.name.replace(/[\u0000-\u001f\u007f/\\]/g, "").trim() || "document").slice(
    0,
    200,
  );
  const storageKey = replacementKey(userId, doc.id, randomUUID().slice(0, 8), type.extension);
  await storage().put(storageKey, bytes, type.mimeType);

  try {
    await db.batch([
      db.delete(extractedFields).where(eq(extractedFields.documentId, doc.id)),
      db.delete(documentPages).where(eq(documentPages.documentId, doc.id)),
      db
        .update(documents)
        .set({
          status: "received",
          processingStage: null,
          errorMessage: null,
          errorDetail: null,
          type: null,
          typeConfidence: null,
          sender: null,
          summary: null,
          pageCount: null,
          originalFileName: fileName,
          mimeType: type.mimeType,
          sizeBytes: bytes.length,
          storageKey,
          sha256,
        })
        .where(and(eq(documents.id, doc.id), eq(documents.userId, userId))),
      auditInsert({
        userId,
        actor: "user",
        action: "document.file_replaced",
        entityType: "document",
        entityId: doc.id,
        before: { fileName: doc.originalFileName, sha256: doc.sha256, status: doc.status },
        after: {
          fileName,
          sha256,
          mimeType: type.mimeType,
          sizeBytes: bytes.length,
          status: "received",
        },
      }),
    ]);
  } catch (error) {
    await storage()
      .delete(storageKey)
      .catch(() => {});
    console.error(`File replacement failed: ${describeError(error)}`);
    return fail(500, { ok: false, error: "failed" });
  }

  await deleteStoredFiles([doc.storageKey]);

  try {
    await inngest.send(
      documentUploaded.create(
        { documentId: doc.id, userId },
        { id: `replace-${doc.id}-${sha256.slice(0, 16)}` },
      ),
    );
  } catch (error) {
    const detail = describeError(error);
    console.error(`Could not queue document processing: ${detail}`);
    await markFailed({ documentId: doc.id, userId }, queueErrorCode(error), detail);
  }

  return NextResponse.json<UploadResponse>({ ok: true, documentId: doc.id }, { status: 200 });
}
