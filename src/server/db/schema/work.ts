import { date, index, integer, numeric, pgTable, uuid } from "drizzle-orm/pg-core";

import { id, timestamps, userId } from "./columns";
import { documents } from "./documents";

export const workEntries = pgTable(
  "work_entries",
  {
    id: id(),
    userId: userId(),
    documentId: uuid().references(() => documents.id, { onDelete: "set null" }),
    /** First day of the month the entry covers. */
    month: date({ mode: "string" }).notNull(),
    fullDays: integer().notNull().default(0),
    halfDays: integer().notNull().default(0),
    hours: numeric({ precision: 6, scale: 2 }),
    ...timestamps,
  },
  (t) => [index().on(t.userId, t.month)],
);
