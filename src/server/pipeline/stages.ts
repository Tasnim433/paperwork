/**
 * Pipeline stages. Each stage reads what it needs from the database and writes
 * its result back, so every stage can be retried on its own.
 */
import { and, asc, eq } from "drizzle-orm";

import { defaultLocale, isLocale } from "@/i18n/config";
import { pageTextFromWords } from "@/lib/text/pdf-words";
import { locateSourceText } from "@/lib/text/locate";
import type { PageText } from "@/lib/text/types";
import { documentFields, type DocumentTypeKey } from "@/lib/schemas/document-fields";
import {
  flaggedCount,
  validateDocument,
  type FieldInput,
} from "@/lib/validation/validate-document";

import {
  classifyDocument,
  documentPrompt,
  extractFields,
  modelInfo,
  summarizeDocument,
} from "../ai";
import { auditInsert } from "../audit";
import { db } from "../db";
import {
  documentPages,
  documents,
  extractedFields,
  userSettings,
  type ProcessingStage,
} from "../db/schema";
import { storage } from "../storage";
import { extractText } from "./text-extraction";

type Ref = { documentId: string; userId: string };

async function loadDocument({ documentId, userId }: Ref) {
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, documentId), eq(documents.userId, userId)),
  });
  if (!doc) throw new Error(`Document not found: ${documentId}`);
  return doc;
}

export async function setStage({ documentId, userId }: Ref, stage: ProcessingStage) {
  await db
    .update(documents)
    .set({ status: "processing", processingStage: stage, errorMessage: null, errorDetail: null })
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
}

async function loadPages({
  documentId,
  userId,
}: Ref): Promise<{ pages: PageText[]; text: string }> {
  const rows = await db
    .select()
    .from(documentPages)
    .where(and(eq(documentPages.documentId, documentId), eq(documentPages.userId, userId)))
    .orderBy(asc(documentPages.pageNumber));
  const pages = rows.map((row) => ({
    pageNumber: row.pageNumber,
    width: row.width,
    height: row.height,
    source: row.source,
    words: row.words,
  }));
  const text = documentPrompt(rows.map((row) => ({ pageNumber: row.pageNumber, text: row.text })));
  return { pages, text };
}

/** a. Text recognition: words with positions from the PDF text layer or OCR. */
export async function recognizeText(ref: Ref) {
  const doc = await loadDocument(ref);
  const bytes = await storage().get(doc.storageKey);
  const pages = await extractText(bytes, doc.mimeType);
  const wordCount = pages.reduce((sum, page) => sum + page.words.length, 0);
  const source = pages.some((page) => page.source === "ocr") ? "ocr" : "text_layer";

  await db.batch([
    db.delete(documentPages).where(eq(documentPages.documentId, doc.id)),
    db.insert(documentPages).values(
      pages.map((page) => ({
        userId: doc.userId,
        documentId: doc.id,
        pageNumber: page.pageNumber,
        width: page.width,
        height: page.height,
        source: page.source,
        text: pageTextFromWords(page.words),
        words: page.words,
      })),
    ),
    db.update(documents).set({ pageCount: pages.length }).where(eq(documents.id, doc.id)),
    auditInsert({
      userId: doc.userId,
      actor: "system",
      action: "document.text_recognized",
      entityType: "document",
      entityId: doc.id,
      after: { pages: pages.length, words: wordCount, source },
    }),
  ]);
  return { pages: pages.length, words: wordCount, source };
}

/** b. Classification into one of the fixed document types. */
export async function classify(ref: Ref) {
  const { text } = await loadPages(ref);
  const result = await classifyDocument(text);
  await db.batch([
    db
      .update(documents)
      .set({ type: result.type, typeConfidence: result.confidence })
      .where(and(eq(documents.id, ref.documentId), eq(documents.userId, ref.userId))),
    auditInsert({
      userId: ref.userId,
      actor: "ai",
      action: "document.classified",
      entityType: "document",
      entityId: ref.documentId,
      after: { ...result, ...modelInfo() },
    }),
  ]);
  return result;
}

/** c + d. Extraction of the type's fields, then locating each value in the recognized words. */
export async function extract(ref: Ref) {
  const doc = await loadDocument(ref);
  const type = (doc.type ?? "other") as DocumentTypeKey;
  const { pages, text } = await loadPages(ref);
  const values = await extractFields(type, text);

  const rows = documentFields[type].map((definition) => {
    const extracted = values[definition.key];
    const located =
      extracted?.value && extracted.sourceText
        ? (locateSourceText(pages, extracted.sourceText) ??
          locateSourceText(pages, extracted.value))
        : null;
    return {
      userId: doc.userId,
      documentId: doc.id,
      key: definition.key,
      value: extracted?.value ?? null,
      originalValue: extracted?.value ?? null,
      confidence: extracted?.value ? extracted.confidence : null,
      // Preliminary; set by the validation stage.
      state: extracted?.value ? ("check" as const) : ("missing" as const),
      sourcePage: located?.page ?? null,
      sourceText: extracted?.sourceText ?? null,
      boundingBox: located?.boundingBox ?? null,
    };
  });

  const sender = values.sender?.value ?? null;
  await db.batch([
    db.delete(extractedFields).where(eq(extractedFields.documentId, doc.id)),
    db.insert(extractedFields).values(rows),
    db.update(documents).set({ sender }).where(eq(documents.id, doc.id)),
    auditInsert({
      userId: doc.userId,
      actor: "ai",
      action: "document.extracted",
      entityType: "document",
      entityId: doc.id,
      after: {
        fields: rows.filter((row) => row.value).length,
        located: rows.filter((row) => row.sourcePage !== null).length,
        ...modelInfo(),
      },
    }),
  ]);
  return { fields: rows.length, found: rows.filter((row) => row.value).length };
}

/** e. Validation with deterministic rules; sets each field's state. */
export async function validate(ref: Ref) {
  const doc = await loadDocument(ref);
  const type = (doc.type ?? "other") as DocumentTypeKey;
  const rows = await db
    .select()
    .from(extractedFields)
    .where(eq(extractedFields.documentId, doc.id));

  const inputs: Record<string, FieldInput> = Object.fromEntries(
    rows.map((row) => [
      row.key,
      { value: row.originalValue, confidence: row.confidence, located: row.sourcePage !== null },
    ]),
  );
  const results = validateDocument(type, inputs);
  const rowByKey = new Map(rows.map((row) => [row.key, row]));

  const updates = results
    .filter((result) => rowByKey.has(result.key))
    .map((result) =>
      db
        .update(extractedFields)
        .set({ value: result.value, state: result.state, rule: result.rule })
        .where(eq(extractedFields.id, rowByKey.get(result.key)!.id)),
    );
  await db.batch([
    auditInsert({
      userId: doc.userId,
      actor: "system",
      action: "document.validated",
      entityType: "document",
      entityId: doc.id,
      after: {
        valid: results.filter((r) => r.state === "valid").length,
        check: results.filter((r) => r.state === "check").length,
        missing: results.filter((r) => r.state === "missing").length,
      },
    }),
    ...updates,
  ]);
  return { flagged: flaggedCount(results) };
}

/** f. Plain-language summary in the user's language; then the document is ready for review. */
export async function summarize(ref: Ref) {
  const doc = await loadDocument(ref);
  const { text } = await loadPages(ref);
  const fields = await db
    .select({ key: extractedFields.key, value: extractedFields.value })
    .from(extractedFields)
    .where(eq(extractedFields.documentId, doc.id));
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, doc.userId),
    columns: { locale: true },
  });
  const locale = isLocale(settings?.locale) ? settings.locale : defaultLocale;

  const summary = await summarizeDocument({
    type: (doc.type ?? "other") as DocumentTypeKey,
    locale,
    text,
    fields,
  });

  await db.batch([
    db
      .update(documents)
      .set({
        summary,
        status: "needs_review",
        processingStage: null,
        errorMessage: null,
        errorDetail: null,
      })
      .where(eq(documents.id, doc.id)),
    auditInsert({
      userId: doc.userId,
      actor: "ai",
      action: "document.summarized",
      entityType: "document",
      entityId: doc.id,
      after: { locale, ...modelInfo() },
    }),
    auditInsert({
      userId: doc.userId,
      actor: "system",
      action: "document.ready_for_review",
      entityType: "document",
      entityId: doc.id,
      before: { status: "processing" },
      after: { status: "needs_review" },
    }),
  ]);
}

/**
 * Marks a document as failed in the stage it was in. `code` is translated in the
 * UI; `detail` is the technical error shown underneath (see describeError).
 */
export async function markFailed(ref: Ref, code: string, detail: string | null = null) {
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, ref.documentId), eq(documents.userId, ref.userId)),
    columns: { id: true, status: true, processingStage: true },
  });
  if (!doc) return;
  await db.batch([
    db
      .update(documents)
      .set({ status: "failed", errorMessage: code, errorDetail: detail })
      .where(eq(documents.id, doc.id)),
    auditInsert({
      userId: ref.userId,
      actor: "system",
      action: "document.failed",
      entityType: "document",
      entityId: doc.id,
      before: { status: doc.status },
      after: { status: "failed", stage: doc.processingStage, error: code, detail },
    }),
  ]);
}
