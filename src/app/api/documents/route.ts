import { createHash, randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { describeError } from "@/lib/errors";
import { detectFileType, MAX_UPLOAD_BYTES } from "@/lib/files";
import { todayIso } from "@/lib/dates";
import { auditInsert } from "@/server/audit";
import { db } from "@/server/db";
import { documents } from "@/server/db/schema";
import { documentUploaded, inngest } from "@/server/inngest/client";
import { queueErrorCode } from "@/server/pipeline/errors";
import { markFailed } from "@/server/pipeline/stages";
import { getSession } from "@/server/session";
import { originalKey, storage } from "@/server/storage";

export type UploadResponse =
  | { ok: true; documentId: string }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "noFile"
        | "empty"
        | "tooLarge"
        | "unsupportedType"
        | "duplicate"
        | "failed";
      existing?: { receivedDate: string };
    };

const fail = (status: number, body: Extract<UploadResponse, { ok: false }>) =>
  NextResponse.json<UploadResponse>(body, { status });

/** Keeps the original name for display only; never used as a path. */
function displayName(name: string) {
  const cleaned = name.replace(/[\u0000-\u001f\u007f/\\]/g, "").trim();
  return (cleaned || "document").slice(0, 200);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail(401, { ok: false, error: "unauthorized" });
  const userId = session.user.id;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail(400, { ok: false, error: "noFile" });
  if (file.size === 0) return fail(400, { ok: false, error: "empty" });
  if (file.size > MAX_UPLOAD_BYTES) return fail(413, { ok: false, error: "tooLarge" });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectFileType(bytes);
  if (!type) return fail(415, { ok: false, error: "unsupportedType" });

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const existing = await db.query.documents.findFirst({
    where: and(eq(documents.userId, userId), eq(documents.sha256, sha256)),
    columns: { receivedDate: true },
  });
  if (existing) return fail(409, { ok: false, error: "duplicate", existing });

  const documentId = randomUUID();
  const storageKey = originalKey(userId, documentId, type.extension);
  const fileName = displayName(file.name);
  await storage().put(storageKey, bytes, type.mimeType);

  try {
    await db.batch([
      db.insert(documents).values({
        id: documentId,
        userId,
        status: "received",
        originalFileName: fileName,
        mimeType: type.mimeType,
        sizeBytes: bytes.length,
        storageKey,
        sha256,
        receivedDate: todayIso(),
      }),
      auditInsert({
        userId,
        actor: "user",
        action: "document.uploaded",
        entityType: "document",
        entityId: documentId,
        after: { fileName, mimeType: type.mimeType, sizeBytes: bytes.length, sha256 },
      }),
      auditInsert({
        userId,
        actor: "system",
        action: "document.received",
        entityType: "document",
        entityId: documentId,
        after: { status: "received", storageKey },
      }),
    ]);
  } catch (error) {
    // Same file uploaded twice at the same moment: the unique index wins.
    await storage()
      .delete(storageKey)
      .catch(() => {});
    if (String((error as Error)?.message).includes("documents_user_id_sha256_unique")) {
      return fail(409, { ok: false, error: "duplicate" });
    }
    console.error(`Upload failed: ${describeError(error)}`);
    return fail(500, { ok: false, error: "failed" });
  }

  try {
    await inngest.send(
      documentUploaded.create({ documentId, userId }, { id: `upload-${documentId}` }),
    );
  } catch (error) {
    // The file is stored; the user can start processing again with Retry.
    const detail = describeError(error);
    console.error(`Could not queue document processing: ${detail}`);
    await markFailed({ documentId, userId }, queueErrorCode(error), detail);
  }

  return NextResponse.json<UploadResponse>({ ok: true, documentId }, { status: 201 });
}
