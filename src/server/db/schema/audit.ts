import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { id, userId } from "./columns";
import { auditActor } from "./enums";

/** Append-only. Rows are never updated. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    userId: userId(),
    actor: auditActor().notNull(),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text().notNull(),
    before: jsonb(),
    after: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId, t.createdAt)],
);
