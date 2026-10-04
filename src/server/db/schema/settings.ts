import { integer, pgTable, text } from "drizzle-orm/pg-core";

import { timestamps, userId } from "./columns";

export const userSettings = pgTable("user_settings", {
  userId: userId().primaryKey(),
  locale: text().notNull().default("de"),
  /** Days before a deadline when reminders are sent. */
  reminderOffsetDays: integer().array().notNull().default([7, 3, 1]),
  /** History log entries older than this many months are removed daily; 0 keeps everything. */
  historyRetentionMonths: integer().notNull().default(12),
  ...timestamps,
});
