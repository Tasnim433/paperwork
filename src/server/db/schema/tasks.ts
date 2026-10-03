import { date, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { id, timestamps, userId } from "./columns";
import { documents } from "./documents";
import { taskKind, taskStatus } from "./enums";

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    userId: userId(),
    documentId: uuid().references(() => documents.id, { onDelete: "cascade" }),
    kind: taskKind().notNull(),
    title: text().notNull(),
    dueDate: date({ mode: "string" }),
    amountCents: integer(),
    status: taskStatus().notNull().default("open"),
    completedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.userId, t.status, t.dueDate), index().on(t.documentId)],
);

export const reminders = pgTable(
  "reminders",
  {
    id: id(),
    userId: userId(),
    taskId: uuid()
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    sendAt: timestamp({ withTimezone: true }).notNull(),
    sentAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.taskId), index().on(t.sendAt)],
);
