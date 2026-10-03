import { pgEnum } from "drizzle-orm/pg-core";

export const documentStatus = pgEnum("document_status", [
  "received",
  "processing",
  "needs_review",
  "confirmed",
  "information_only",
  "rejected",
  "failed",
]);

/** Pipeline stage a document is in (or failed in, when status is "failed"). */
export const processingStage = pgEnum("processing_stage", [
  "text_recognition",
  "classification",
  "extraction",
  "validation",
  "summary",
]);

export const pageTextSource = pgEnum("page_text_source", ["text_layer", "ocr"]);

export const documentType = pgEnum("document_type", [
  "invoice",
  "appointment",
  "decision_letter",
  "contract",
  "payslip",
  "information_only",
  "other",
]);

export const fieldState = pgEnum("field_state", ["valid", "check", "missing"]);

export const taskKind = pgEnum("task_kind", ["pay", "attend", "submit", "prepare", "respond"]);

export const taskStatus = pgEnum("task_status", ["open", "done"]);

export const auditActor = pgEnum("audit_actor", ["system", "ai", "user"]);

export type DocumentStatus = (typeof documentStatus.enumValues)[number];
export type ProcessingStage = (typeof processingStage.enumValues)[number];
export type DocumentType = (typeof documentType.enumValues)[number];
export type FieldState = (typeof fieldState.enumValues)[number];
export type TaskKind = (typeof taskKind.enumValues)[number];
export type TaskStatus = (typeof taskStatus.enumValues)[number];
export type AuditActor = (typeof auditActor.enumValues)[number];
