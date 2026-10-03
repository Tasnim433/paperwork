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

import { id, timestamps, userId } from "./columns";
import { documentStatus, documentType, fieldState } from "./enums";

export const documents = pgTable(
  "documents",
  {
    id: id(),
    userId: userId(),
    status: documentStatus().notNull().default("received"),
    type: documentType(),
    originalFileName: text().notNull(),
    mimeType: text().notNull(),
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

/** Bounding box of a value in the original, relative to the page size (0 to 1). */
export type BoundingBox = { x: number; y: number; width: number; height: number };

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
