import { text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const id = () => uuid().primaryKey().defaultRandom();

export const userId = () =>
  text()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
