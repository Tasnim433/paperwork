import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { BoundingBox, PageWord } from "../../../lib/text/types";

import { id, timestamps, userId } from "./columns";
import { documentStatus, documentType, fieldState, pageTextSource, processingStage } from "./enums";

export type { BoundingBox, PageWord };

export const documents = pgTable(
  "documents",
  {
    id: id(),
    userId: userId(),
    status: documentStatus().notNull().default("received"),
    /** Current pipeline stage; when status is "failed", the stage that failed. */
    processingStage: processingStage(),
    /** User-safe code of the last failure (e.g. "rate_limited"), translated in the UI. */
    errorMessage: text(),
    /** Technical description of the last failure (causes unwrapped), shown under the reason. */
    errorDetail: text(),
    type: documentType(),
    typeConfidence: real(),
    originalFileName: text().notNull(),
    mimeType: text().notNull(),
    sizeBytes: integer(),
    pageCount: integer(),
    storageKey: text().notNull(),
    sha256: text().notNull(),
    sender: text(),
    receivedDate: date({ mode: "string" }).notNull(),
    summary: text(),
    ...timestamps,
  },
  (t) => [
    index().on(t.userId, t.status),
    uniqueIndex("documents_user_id_sha256_unique").on(t.userId, t.sha256),
  ],
);

/** Recognized text of one page, with word positions for highlighting in the original. */
export const documentPages = pgTable(
  "document_pages",
  {
    id: id(),
    userId: userId(),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    pageNumber: integer().notNull(),
    width: real().notNull(),
    height: real().notNull(),
    source: pageTextSource().notNull(),
    text: text().notNull(),
    words: jsonb().$type<PageWord[]>().notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("document_pages_document_id_page_unique").on(t.documentId, t.pageNumber)],
);

export const extractedFields = pgTable(
  "extracted_fields",
  {
    id: id(),
    userId: userId(),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    key: text().notNull(),
    value: text(),
    originalValue: text(),
    confidence: real(),
    state: fieldState().notNull(),
    /** Validation rule that set a "check" or "missing" state, e.g. "date.invalid". */
    rule: text(),
    sourcePage: integer(),
    sourceText: text(),
    boundingBox: jsonb().$type<BoundingBox>(),
    editedByUser: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index().on(t.userId),
    uniqueIndex("extracted_fields_document_id_key_unique").on(t.documentId, t.key),
  ],
);
