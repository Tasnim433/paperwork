import { db } from "./db";
import { auditLog, type AuditActor } from "./db/schema";

type AuditEntry = {
  userId: string;
  actor: AuditActor;
  action: string;
  entityType: "document" | "task" | "field" | "work_entry" | "settings";
  entityId: string;
  before?: unknown;
  after?: unknown;
};

/** Builds an audit log insert. Pass it to `db.batch` together with the change it records. */
export function auditInsert(entry: AuditEntry) {
  return db.insert(auditLog).values({
    ...entry,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}
